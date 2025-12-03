import { v } from 'convex/values'
import { pick } from 'convex-helpers'
import { api, internal } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'
import { internalMutation, mutation, query } from './_generated/server'
import { generateSignedDownloadUrl } from './lib/r2'
import { buildFields } from './schema'

export enum ArtifactType {
  Firmware = 'firmware',
  Source = 'source',
}

type BuildUpdateData = {
  status: string
  completedAt?: number
}

export const get = query({
  args: { id: v.id('builds') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id)
  },
})

export const getByHash = query({
  args: { buildHash: v.string() },
  handler: async (ctx, args) => {
    const build = await ctx.db
      .query('builds')
      .filter((q) => q.eq(q.field('buildHash'), args.buildHash))
      .unique()
    return build ?? null
  },
})

/**
 * Computes flags string from build config.
 * Only excludes modules explicitly marked as excluded (config[id] === true).
 */
export function computeFlagsFromConfig(
  config: Doc<'builds'>['config']
): string {
  // Sort modules to ensure consistent order
  return Object.keys(config.modulesExcluded)
    .sort()
    .filter((module) => config.modulesExcluded[module])
    .map((moduleExcludedName: string) => `-D${moduleExcludedName}=1`)
    .join(' ')
}

/**
 * Encodes a byte array to base62 string.
 * Uses characters: 0-9, a-z, A-Z (62 characters total)
 */
function base62Encode(bytes: Uint8Array): string {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'

  // Convert bytes to a big-endian number
  let num = BigInt(0)
  for (let i = 0; i < bytes.length; i++) {
    num = num * BigInt(256) + BigInt(bytes[i])
  }

  // Convert number to base62
  if (num === BigInt(0)) return '0'

  const result: string[] = []
  while (num > BigInt(0)) {
    result.push(chars[Number(num % BigInt(62))])
    num = num / BigInt(62)
  }

  return result.reverse().join('')
}

/**
 * Computes a stable SHA-256 hash from version, target, flags, and plugins.
 * Internal helper for hash computation.
 */
async function computeBuildHashInternal(
  version: string,
  target: string,
  flags: string,
  plugins: string[]
): Promise<string> {
  // Input is now the exact parameters used for the build
  // Sort plugins array for consistent hashing
  const sortedPlugins = [...plugins].sort()
  const input = JSON.stringify({
    version,
    target,
    flags,
    plugins: sortedPlugins,
  })

  // Use Web Crypto API for SHA-256 hashing
  const encoder = new TextEncoder()
  const data = encoder.encode(input)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashBytes = new Uint8Array(hashBuffer)

  // Encode to base62 instead of hex
  return base62Encode(hashBytes)
}

/**
 * Computes buildHash from build config.
 * This is the single source of truth for build hash computation.
 */
export async function computeBuildHash(
  config: Doc<'builds'>['config']
): Promise<{ hash: string; flags: string }> {
  const flags = computeFlagsFromConfig(config)
  const plugins = config.pluginsEnabled ?? []
  const hash = await computeBuildHashInternal(
    config.version,
    config.target,
    flags,
    plugins
  )
  return { hash, flags }
}

/**
 * Constructs the R2 artifact URL from a build.
 * Uses {artifactType}-<buildHash>-<githubRunId>.tar.gz format.
 */
export function getR2ArtifactUrl(
  build: Pick<Doc<'builds'>, 'buildHash' | 'githubRunId'>,
  artifactType: ArtifactType
): string {
  const r2PublicUrl = process.env.R2_PUBLIC_URL
  if (!r2PublicUrl) {
    throw new Error('R2_PUBLIC_URL is not set')
  }
  if (!build.githubRunId) {
    throw new Error('githubRunId is required to construct artifact URL')
  }
  const artifactTypeStr =
    artifactType === ArtifactType.Source ? 'source' : 'firmware'
  const path = `/${artifactTypeStr}-${build.buildHash}-${build.githubRunId}.tar.gz`
  return `${r2PublicUrl}${path}`
}

// Internal mutation to upsert a build by buildHash
// This is the single source of truth for build creation
export const upsertBuild = internalMutation({
  args: {
    ...pick(buildFields, ['buildHash', 'config']),
    status: v.optional(v.string()),
    flags: v.string(),
  },

  handler: async (ctx, args) => {
    // Check if build already exists with this hash
    const existingBuild = await ctx.db
      .query('builds')
      .filter((q) => q.eq(q.field('buildHash'), args.buildHash))
      .unique()

    const { status, buildHash, config, flags } = args

    if (existingBuild) {
      await ctx.db.patch(existingBuild._id, {
        status: status ?? existingBuild.status,
        updatedAt: Date.now(),
      })
      return existingBuild._id
    }

    // Create new build (artifact paths are omitted, will be undefined)
    const buildId = await ctx.db.insert('builds', {
      status: 'queued',
      startedAt: Date.now(),
      buildHash,
      updatedAt: Date.now(),
      config,
    })

    // Dispatch GitHub workflow if needed
    await ctx.scheduler.runAfter(0, api.actions.dispatchGithubBuild, {
      target: config.target,
      version: config.version,
      buildId,
      flags,
      buildHash,
      plugins: config.pluginsEnabled ?? [],
    })

    return buildId
  },
})

export const ensureBuildFromConfig = mutation({
  args: {
    target: v.string(),
    version: v.string(),
    modulesExcluded: v.optional(v.record(v.string(), v.boolean())),
    pluginsEnabled: v.optional(v.array(v.string())),
    profileName: v.optional(v.string()),
    profileDescription: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Construct config for the build
    const config: Doc<'builds'>['config'] = {
      version: args.version,
      modulesExcluded: args.modulesExcluded ?? {},
      target: args.target,
      pluginsEnabled: args.pluginsEnabled,
    }

    // Compute build hash (single source of truth)
    const { hash: buildHash, flags } = await computeBuildHash(config)

    const existingBuild = await ctx.db
      .query('builds')
      .filter((q) => q.eq(q.field('buildHash'), buildHash))
      .unique()

    if (existingBuild) {
      return {
        buildId: existingBuild._id,
        existed: true,
        buildHash,
      }
    }

    const buildId: Id<'builds'> = await ctx.runMutation(
      internal.builds.upsertBuild,
      {
        buildHash,
        flags,
        config,
      }
    )

    return {
      buildId,
      existed: false,
      buildHash,
    }
  },
})

// Internal query to get build without auth checks (for webhooks)
export const getInternal = internalMutation({
  args: { buildId: v.id('builds') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.buildId)
  },
})

// Internal mutation to log errors from actions
export const logBuildError = internalMutation({
  args: {
    buildId: v.id('builds'),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.buildId, {
      status: 'failure',
      completedAt: Date.now(),
    })
  },
})

// Internal mutation to update build status
export const updateBuildStatus = internalMutation({
  args: {
    ...pick(buildFields, [
      'status',
      'completedAt',
      'githubRunId',
      'firmwarePath',
      'sourcePath',
    ]),
    buildId: v.id('builds'),
  },
  handler: async (ctx, args) => {
    const build = await ctx.db.get(args.buildId)
    if (!build) return

    const updateData: BuildUpdateData & {
      githubRunId?: number
      githubRunIdHistory?: number[]
      firmwarePath?: string
      sourcePath?: string
    } = {
      status: args.status,
    }

    // Only set completedAt for final statuses
    if (args.status === 'success' || args.status === 'failure') {
      updateData.completedAt = Date.now()
    }

    // Clear artifact paths when build starts (queued status)
    if (args.status === 'queued') {
      updateData.firmwarePath = undefined
      updateData.sourcePath = undefined
    }

    // Set firmwarePath if provided
    if (args.firmwarePath !== undefined) {
      updateData.firmwarePath = args.firmwarePath
    }

    // Set sourcePath if provided
    if (args.sourcePath !== undefined) {
      updateData.sourcePath = args.sourcePath
    }

    // Set githubRunId if provided
    // When a new run ID comes in, move the previous one to history
    const existingHistory = [...new Set(build.githubRunIdHistory || [])]
    if (args.githubRunId !== undefined) {
      const existingRunId = build.githubRunId
      // Only update if the run ID is actually changing
      if (existingRunId !== undefined && existingRunId !== args.githubRunId) {
        // Prepend existing run ID to history array, avoiding duplicates
        existingHistory.unshift(existingRunId)
        // Clear artifact paths when a new run starts
        updateData.firmwarePath = undefined
        updateData.sourcePath = undefined
      }
      updateData.githubRunId = args.githubRunId
    }

    updateData.githubRunIdHistory = [...new Set(existingHistory)].filter(
      (id) => id !== args.githubRunId
    )

    await ctx.db.patch(args.buildId, updateData)
  },
})

export const generateDownloadUrl = mutation({
  args: {
    buildId: v.id('builds'),
    artifactType: v.union(v.literal('firmware'), v.literal('source')),
    profileId: v.optional(v.id('profiles')),
  },
  handler: async (ctx, args) => {
    const build = await ctx.db.get(args.buildId)
    if (!build) throw new Error('Build not found')

    if (!build.githubRunId) {
      throw new Error('Build githubRunId is required for download')
    }

    const artifactTypeEnum =
      args.artifactType === 'source'
        ? ArtifactType.Source
        : ArtifactType.Firmware

    const isSource = artifactTypeEnum === ArtifactType.Source
    const artifactTypeStr =
      artifactTypeEnum === ArtifactType.Source ? 'source' : 'firmware'
    const contentType = isSource
      ? 'application/gzip'
      : 'application/octet-stream'

    // Use stored path if available, otherwise construct from buildHash and githubRunId
    const storedPath = isSource ? build.sourcePath : build.firmwarePath
    const objectKey = storedPath
      ? storedPath.startsWith('/')
        ? storedPath.slice(1)
        : storedPath
      : `${artifactTypeStr}-${build.buildHash}-${build.githubRunId}.tar.gz`

    // Fetch profile if profileId is provided
    const profile = await (async () => {
      if (!args.profileId) return
      const profileDoc = await ctx.db.get(args.profileId)
      if (!profileDoc) throw new Error('Profile not found')
      return profileDoc
    })()

    // Slugify profile name for filename (if authenticated)
    const profileSlug = profile
      ? profile.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)+/g, '')
      : ''

    // Increment profile flash count for firmware downloads
    if (profile && !isSource) {
      const nextCount = (profile.flashCount ?? 0) + 1
      await ctx.db.patch(profile._id, {
        flashCount: nextCount,
        updatedAt: Date.now(),
      })
    }

    // Increment plugin flash counts for firmware downloads (independent of profile)
    if (
      !isSource &&
      build.config.pluginsEnabled &&
      build.config.pluginsEnabled.length > 0
    ) {
      await ctx.runMutation(internal.plugins.incrementFlashCount, {
        slugs: build.config.pluginsEnabled,
      })
    }

    const last4Hash = build.buildHash.slice(-4)
    const os = 'meshtastic' // OS/platform identifier
    const version = build.config.version
    const target = build.config.target
    const jobId = build.githubRunId

    // Format: {os}-{version}-{profileSlug}-{target}-{last4hash}-{jobId}-{assetType}.tar.gz
    // If no profile, omit profileSlug and its trailing dash
    const filename = profileSlug
      ? `${os}-${version}-${profileSlug}-${target}-${last4Hash}-${jobId}-${artifactTypeStr}.tar.gz`
      : `${os}-${version}-${target}-${last4Hash}-${jobId}-${artifactTypeStr}.tar.gz`

    return await generateSignedDownloadUrl(objectKey, filename, contentType)
  },
})
