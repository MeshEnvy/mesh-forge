import { getAuthUserId } from '@convex-dev/auth/server'
import type { GenericMutationCtx } from 'convex/server'
import { v } from 'convex/values'
import { pick } from 'convex-helpers'
import { api, internal } from './_generated/api'
import type { DataModel, Id } from './_generated/dataModel'
import { internalMutation, mutation, query } from './_generated/server'
import { generateSignedDownloadUrl } from './lib/r2'
import { type BuildConfigFields, type BuildFields, buildFields } from './schema'

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
export function computeFlagsFromConfig(config: BuildConfigFields): string {
  // Sort modules to ensure consistent order
  return Object.keys(config.modulesExcluded)
    .sort()
    .filter((module) => config.modulesExcluded[module])
    .map((moduleExcludedName: string) => `-D${moduleExcludedName}=1`)
    .join(' ')
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
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')

  return hashHex
}

/**
 * Computes buildHash from build config.
 * This is the single source of truth for build hash computation.
 */
export async function computeBuildHash(
  config: BuildConfigFields
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
 * Uses artifactPath if available, otherwise falls back to buildHash.uf2
 * Or custom domain if R2_PUBLIC_URL is set.
 */
export function getR2ArtifactUrl(
  build: Pick<BuildFields, 'buildHash' | 'artifactPath'>
): string {
  const r2PublicUrl = process.env.R2_PUBLIC_URL
  if (!r2PublicUrl) {
    throw new Error('R2_PUBLIC_URL is not set')
  }
  const path = build.artifactPath || `/${build.buildHash}.uf2`
  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${r2PublicUrl}${normalizedPath}`
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

    // Create new build
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
    const config: BuildConfigFields = {
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
      'artifactPath',
      'githubRunId',
    ]),
    buildId: v.id('builds'),
  },
  handler: async (ctx, args) => {
    const build = await ctx.db.get(args.buildId)
    if (!build) return

    const updateData: BuildUpdateData & {
      artifactPath?: string
      githubRunId?: number
    } = {
      status: args.status,
    }

    // Only set completedAt for final statuses
    if (args.status === 'success' || args.status === 'failure') {
      updateData.completedAt = Date.now()
    }

    // Set artifactPath if provided
    if (args.artifactPath !== undefined) {
      updateData.artifactPath = args.artifactPath
    }

    // Set githubRunId if provided
    if (args.githubRunId !== undefined) {
      updateData.githubRunId = args.githubRunId
    }

    await ctx.db.patch(args.buildId, updateData)
  },
})

/**
 * Helper to generate authenticated download URL
 */
async function generateAuthenticatedDownloadUrl(
  ctx: GenericMutationCtx<DataModel>,
  buildId: Id<'builds'>,
  profileId: Id<'profiles'>,
  objectKey: string,
  ext: string,
  filenameSuffix: string = '',
  contentType: string = 'application/octet-stream',
  incrementFlashCount: boolean = true
): Promise<string> {
  const userId = await getAuthUserId(ctx)
  if (!userId) throw new Error('Unauthorized')

  // Verify profile belongs to user or is public
  const profile = await ctx.db.get(profileId)
  if (!profile) throw new Error('Profile not found')

  // If profile is private, ensure user owns it
  if (profile.isPublic === false && profile.userId !== userId) {
    throw new Error('Unauthorized')
  }

  const build = await ctx.db.get(buildId)
  if (!build) throw new Error('Build not found')

  // Increment flash count for firmware downloads
  if (incrementFlashCount) {
    const nextCount = (profile.flashCount ?? 0) + 1
    await ctx.db.patch(profileId, {
      flashCount: nextCount,
      updatedAt: Date.now(),
    })

    // Increment plugin flash counts if build has plugins enabled
    if (build.config.pluginsEnabled && build.config.pluginsEnabled.length > 0) {
      await ctx.runMutation(internal.plugins.incrementFlashCount, {
        slugs: build.config.pluginsEnabled,
      })
    }
  }

  // Slugify profile name for filename
  const slug = profile.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')

  const filename = `${slug}-${build.config.target}${filenameSuffix}.${ext}`

  return await generateSignedDownloadUrl(objectKey, filename, contentType)
}

/**
 * Helper to generate anonymous download URL
 */
function generateAnonymousDownloadUrlHelper(
  build: BuildFields,
  slug: string,
  objectKey: string,
  ext: string,
  filenameSuffix: string = '',
  contentType: string = 'application/octet-stream'
): Promise<string> {
  const {
    buildHash,
    config: { target, version },
  } = build

  const pfx = slug ? `${slug}-` : ''
  const filename = `${pfx}${target}-${version}-${buildHash.substring(0, 4)}${filenameSuffix}.${ext}`

  return generateSignedDownloadUrl(objectKey, filename, contentType)
}

export const generateDownloadUrl = mutation({
  args: {
    buildId: v.id('builds'),
    profileId: v.id('profiles'),
  },
  handler: async (ctx, args) => {
    const build = await ctx.db.get(args.buildId)
    if (!build) throw new Error('Build not found')

    // User indicated that artifactPath must be present for a valid download
    if (!build.artifactPath) {
      throw new Error('Build artifact path is missing')
    }

    let objectKey = build.artifactPath
    // Remove leading slash if present
    if (objectKey.startsWith('/')) {
      objectKey = objectKey.substring(1)
    }

    // Determine extension from objectKey
    const parts = objectKey.split('.')
    const ext = parts.length > 1 ? parts.pop() : undefined

    if (!ext) {
      throw new Error('Could not determine file extension from artifact path')
    }

    return await generateAuthenticatedDownloadUrl(
      ctx,
      args.buildId,
      args.profileId,
      objectKey,
      ext
    )
  },
})

export const generateAnonymousDownloadUrl = mutation({
  args: {
    build: v.object(buildFields),
    slug: v.string(),
  },
  handler: async (ctx, args) => {
    // Increment plugin flash counts if build has plugins enabled
    if (
      args.build.config.pluginsEnabled &&
      args.build.config.pluginsEnabled.length > 0
    ) {
      await ctx.runMutation(internal.plugins.incrementFlashCount, {
        slugs: args.build.config.pluginsEnabled,
      })
    }

    let objectKey = args.build.artifactPath || ''
    if (objectKey.startsWith('/')) {
      objectKey = objectKey.substring(1)
    }

    const parts = objectKey.split('.')
    const ext = parts.length > 1 ? parts.pop() : undefined
    if (!ext) {
      throw new Error('Could not determine file extension from artifact path')
    }

    return await generateAnonymousDownloadUrlHelper(
      args.build,
      args.slug,
      objectKey,
      ext
    )
  },
})

export const generateSourceDownloadUrl = mutation({
  args: {
    buildId: v.id('builds'),
    profileId: v.id('profiles'),
  },
  handler: async (ctx, args) => {
    const build = await ctx.db.get(args.buildId)
    if (!build) throw new Error('Build not found')

    const objectKey = `${build.buildHash}.tar.gz`

    return await generateAuthenticatedDownloadUrl(
      ctx,
      args.buildId,
      args.profileId,
      objectKey,
      'tar.gz',
      '-source',
      'application/gzip',
      false // Don't increment flash count for source downloads
    )
  },
})

export const generateAnonymousSourceDownloadUrl = mutation({
  args: {
    build: v.object(buildFields),
    slug: v.string(),
  },
  handler: async (_ctx, args) => {
    const objectKey = `${args.build.buildHash}.tar.gz`

    return await generateAnonymousDownloadUrlHelper(
      args.build,
      args.slug,
      objectKey,
      'tar.gz',
      '-source',
      'application/gzip'
    )
  },
})
