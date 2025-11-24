import { getAuthUserId } from '@convex-dev/auth/server'
import { v } from 'convex/values'
import { api } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { internalMutation, mutation, query } from './_generated/server'
import { generateSignedDownloadUrl } from './lib/r2'
import modulesData from './modules.json'

type BuildUpdateData = {
  status: string
  completedAt?: number
}

/**
 * Computes a stable SHA-256 hash from version, target, and flags.
 * This hash uniquely identifies a build configuration based on what is actually executed.
 */
async function computeBuildHash(
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
 * Constructs the R2 artifact URL from a build.
 * Uses artifactPath if available, otherwise falls back to buildHash.uf2
 * Or custom domain if R2_PUBLIC_URL is set.
 */
export function getR2ArtifactUrl(build: {
  buildHash: string
  artifactPath?: string
}): string {
  const r2PublicUrl = process.env.R2_PUBLIC_URL
  if (!r2PublicUrl) {
    throw new Error('R2_PUBLIC_URL is not set')
  }
  const path = build.artifactPath || `/${build.buildHash}.uf2`
  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${r2PublicUrl}${normalizedPath}`
}

export const triggerBuildViaProfile = mutation({
  args: {
    profileId: v.id('profiles'),
    target: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) {
      throw new Error('Unauthorized')
    }

    const profile = await ctx.db.get(args.profileId)
    if (!profile) {
      throw new Error('Profile not found')
    }

    // Convert config object to flags string
    const flags: string[] = []

    // Handle Modules (Inverted Logic: Default Excluded)
    for (const module of modulesData.modules) {
      // If config[id] is NOT false (explicitly included), we exclude it.
      if (profile.config[module.id] !== false) {
        flags.push(`-D${module.id}=1`)
      }
    }

    const flagsString = flags.join(' ')

    // Compute build hash
    const buildHash = await computeBuildHash(
      profile.version,
      args.target,
      flagsString
    )

    // Check if build already exists with this hash
    let existingBuild = await ctx.db
      .query('builds')
      .filter((q) => q.eq('buildHash', buildHash))
      .first()

    let buildId: Id<'builds'>
    let shouldDispatch = false

    if (existingBuild) {
      // Build already exists, use it
      buildId = existingBuild._id
    } else {
      // Create new build and dispatch workflow
      buildId = await ctx.db.insert('builds', {
        target: args.target,
        githubRunId: 0,
        status: 'queued',
        startedAt: Date.now(),
        buildHash: buildHash,
      })
      shouldDispatch = true

      // Handle race condition
      existingBuild = await ctx.db
        .query('builds')
        .filter((q) => q.eq('buildHash', buildHash))
        .first()

      if (existingBuild && existingBuild._id !== buildId) {
        await ctx.db.delete(buildId)
        buildId = existingBuild._id
        shouldDispatch = false
      }
    }

    // Create or update profileBuild record
    // Check if a profileBuild already exists for this profile+target combination
    const profileId = args.profileId as string
    const profileBuilds = await ctx.db
      .query('profileBuilds')
      .filter((q) => q.eq('profileId', profileId))
      .collect()

    // Find existing profileBuild with matching target by checking the build
    let foundExisting = null
    for (const pb of profileBuilds) {
      const build = await ctx.db.get(pb.buildId)
      if (build?.target === args.target) {
        foundExisting = pb
        break
      }
    }

    if (foundExisting) {
      await ctx.db.patch(foundExisting._id, {
        buildId: buildId,
      })
    } else {
      await ctx.db.insert('profileBuilds', {
        profileId: args.profileId,
        buildId: buildId,
      })
    }

    // Dispatch GitHub workflow if needed
    if (shouldDispatch) {
      await ctx.scheduler.runAfter(0, api.actions.dispatchGithubBuild, {
        buildId: buildId,
        target: args.target,
        flags: flagsString,
        version: profile.version,
        buildHash: buildHash,
      })
    }

    return buildId
  },
})

export const listByProfile = query({
  args: { profileId: v.id('profiles') },
  handler: async (ctx, args) => {
    // Query profileBuilds for this profile
    const listProfileId = args.profileId as string
    const profileBuilds = await ctx.db
      .query('profileBuilds')
      .filter((q) => q.eq('profileId', listProfileId))
      .collect()

    // Get builds for each profileBuild
    const builds = await Promise.all(
      profileBuilds.map(async (pb) => {
        const build = await ctx.db.get(pb.buildId)
        if (!build) return null
        // Return build with computed artifactUrl
        return {
          ...build,
          artifactUrl: getR2ArtifactUrl(build),
        }
      })
    )

    // Filter out nulls and sort by startedAt descending
    return builds
      .filter((b): b is NonNullable<typeof b> => b !== null)
      .sort((a, b) => b.startedAt - a.startedAt)
      .slice(0, 10)
  },
})

export const get = query({
  args: { buildId: v.id('builds') },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return null

    const build = await ctx.db.get(args.buildId)
    if (!build) return null

    // Check if user has access via profileBuilds
    // Get all profileBuilds for this build
    const buildId = args.buildId as string
    const profileBuilds = await ctx.db
      .query('profileBuilds')
      .filter((q) => q.eq('buildId', buildId))
      .collect()

    // Check if any of these profileBuilds link to a profile owned by the user
    for (const pb of profileBuilds) {
      const profile = await ctx.db.get(pb.profileId)
      if (profile && profile.userId === userId) {
        // Return build with computed artifactUrl
        return {
          ...build,
          artifactUrl: getR2ArtifactUrl(build),
        }
      }
    }

    return null
  },
})

// Internal query to get build without auth checks (for webhooks)
export const getInternal = internalMutation({
  args: { buildId: v.id('builds') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.buildId)
  },
})

export const deleteBuild = mutation({
  args: {
    buildId: v.id('builds'),
    profileId: v.id('profiles'),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error('Unauthorized')

    // Verify profile belongs to user
    const profile = await ctx.db.get(args.profileId)
    if (!profile || profile.userId !== userId) {
      throw new Error('Unauthorized')
    }

    // Find profileBuild linking this profile to this build
    const buildId = args.buildId as string
    const profileBuilds = await ctx.db
      .query('profileBuilds')
      .filter((q) => q.eq('buildId', buildId))
      .collect()

    const profileBuild = profileBuilds.find(
      (pb) => pb.profileId === args.profileId
    )

    if (!profileBuild) {
      throw new Error('ProfileBuild not found')
    }

    // Delete only the profileBuild record (not the underlying build)
    await ctx.db.delete(profileBuild._id)
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
    buildId: v.id('builds'),
    status: v.string(), // Accepts any status string value
    artifactPath: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const build = await ctx.db.get(args.buildId)
    if (!build) return

    const updateData: BuildUpdateData & { artifactPath?: string } = {
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
