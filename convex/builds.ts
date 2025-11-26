import { getAuthUserId } from '@convex-dev/auth/server'
import { v } from 'convex/values'
import { pick } from 'convex-helpers'
import { api, internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { internalMutation, mutation, query } from './_generated/server'
import { generateSignedDownloadUrl } from './lib/r2'
import { type BuildFields, buildFields, type ProfileFields } from './schema'

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

/**
 * Computes flags string from profile config.
 * Only excludes modules explicitly marked as excluded (config[id] === true).
 */
export function computeFlagsFromProfile(
  config: ProfileFields['config']
): string {
  // Sort modules to ensure consistent order
  return Object.keys(config.modulesExcluded)
    .sort()
    .filter((module) => config.modulesExcluded[module])
    .map((moduleExcludedName: string) => `-D${moduleExcludedName}=1`)
    .join(' ')
}

/**
 * Computes a stable SHA-256 hash from version, target, and flags.
 * This hash uniquely identifies a build configuration based on what is actually executed.
 */
export async function computeBuildHash(
  version: string,
  target: string,
  flags: string
): Promise<string> {
  // Input is now the exact parameters used for the build
  const input = JSON.stringify({
    version,
    target,
    flags,
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
 * Computes buildHash for a profile and target.
 * This is the single source of truth for build hash computation.
 */
export async function computeBuildHashForProfile(
  profile: ProfileFields,
  target: string
): Promise<{ hash: string; flags: string }> {
  const flags = computeFlagsFromProfile(profile.config)
  const hash = await computeBuildHash(profile.version, target, flags)
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
    ...pick(buildFields, ['buildHash', 'target', 'version', 'profileString']),
    status: v.optional(v.string()),
    flags: v.string(),
  },

  handler: async (ctx, args) => {
    // Check if build already exists with this hash
    const existingBuild = await ctx.db
      .query('builds')
      .filter((q) => q.eq(q.field('buildHash'), args.buildHash))
      .unique()

    const { status, buildHash, target, version, profileString, flags } = args

    if (existingBuild) {
      await ctx.db.patch(existingBuild._id, {
        status: status ?? existingBuild.status,
        updatedAt: Date.now(),
      })
      return existingBuild._id
    }

    // Create new build
    const buildId = await ctx.db.insert('builds', {
      target,
      status: 'queued',
      startedAt: Date.now(),
      buildHash,
      updatedAt: Date.now(),
      version,
      profileString,
    })

    // Dispatch GitHub workflow if needed
    await ctx.scheduler.runAfter(0, api.actions.dispatchGithubBuild, {
      buildId,
      target,
      flags,
      version,
      buildHash,
    })

    return buildId
  },
})

export const ensureBuildForProfileTarget = mutation({
  args: {
    profileId: v.id('profiles'),
    target: v.string(),
  },
  handler: async (ctx, args): Promise<Id<'builds'>> => {
    const userId = await getAuthUserId(ctx)
    if (!userId) {
      throw new Error('Unauthorized')
    }

    const profile = await ctx.db.get(args.profileId)
    if (!profile) {
      throw new Error('Profile not found')
    }

    // Compute build hash (single source of truth)
    const { hash: buildHash, flags: flagsString } =
      await computeBuildHashForProfile(profile, args.target)

    // Upsert the build (single source of truth)
    const buildId: Id<'builds'> = await ctx.runMutation(
      internal.builds.upsertBuild,
      {
        buildHash,
        target: args.target,
        flags: flagsString,
        version: profile.version,
        profileString: JSON.stringify(profile),
      }
    )

    return buildId
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

export const generateDownloadUrl = mutation({
  args: {
    buildId: v.id('builds'),
    profileId: v.id('profiles'),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error('Unauthorized')

    // Verify profile belongs to user or is public
    const profile = await ctx.db.get(args.profileId)
    if (!profile) throw new Error('Profile not found')

    // If profile is private, ensure user owns it
    if (profile.isPublic === false && profile.userId !== userId) {
      throw new Error('Unauthorized')
    }

    const build = await ctx.db.get(args.buildId)
    if (!build) throw new Error('Build not found')

    // Increment flash count
    const nextCount = (profile.flashCount ?? 0) + 1
    await ctx.db.patch(args.profileId, {
      flashCount: nextCount,
      updatedAt: Date.now(),
    })

    // Slugify profile name for filename
    const slug = profile.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '')

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

    const filename = `${slug}-${build.target}.${ext}`

    return await generateSignedDownloadUrl(
      objectKey,
      filename,
      'application/octet-stream'
    )
  },
})
