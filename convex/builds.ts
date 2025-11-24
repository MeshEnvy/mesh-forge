import { getAuthUserId } from '@convex-dev/auth/server'
import { v } from 'convex/values'
import { api } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { internalMutation, mutation, query } from './_generated/server'
import modulesData from './modules.json'

type BuildUpdateData = {
  status: string
  completedAt?: number
  artifactUrl?: string
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
 * Constructs the R2 artifact URL from a build hash.
 * Uses the R2 public URL pattern: https://<bucket>.<account-id>.r2.cloudflarestorage.com/<hash>.uf2
 * Or custom domain if R2_PUBLIC_URL is set.
 */
function getR2ArtifactUrl(buildHash: string): string {
  const r2PublicUrl = process.env.R2_PUBLIC_URL
  if (r2PublicUrl) {
    // Custom domain configured
    return `${r2PublicUrl}/${buildHash}.uf2`
  }
  // Default R2 public URL pattern (requires public bucket)
  const bucketName = process.env.R2_BUCKET_NAME || 'firmware-builds'
  const accountId = process.env.R2_ACCOUNT_ID || ''
  if (accountId) {
    return `https://${bucketName}.${accountId}.r2.cloudflarestorage.com/${buildHash}.uf2`
  }
  // Fallback: assume custom domain or public bucket URL
  return `https://${bucketName}.r2.cloudflarestorage.com/${buildHash}.uf2`
}

export const triggerBuild = mutation({
  args: {
    profileId: v.id('profiles'),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error('Unauthorized')

    const profile = await ctx.db.get(args.profileId)
    if (!profile || profile.userId !== userId) {
      throw new Error('Unauthorized')
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

    // Get targets from profileTargets
    const profileTargets = await ctx.db
      .query('profileTargets')
      .withIndex('by_profile', (q) => q.eq('profileId', args.profileId))
      .collect()

    const targets = profileTargets.map((pt) => pt.target)

    // Create build records for each target
    for (const target of targets) {
      // Compute build hash using the generated flags
      const buildHash = await computeBuildHash(
        profile.version,
        target,
        flagsString
      )

      console.log(
        `Computed build hash for ${target}: ${buildHash} (Flags: ${flagsString})`
      )

      // Mutex logic: Check if build already exists with this hash
      const build = await ctx.db
        .query('builds')
        .withIndex('by_hash', (q) => q.eq('buildHash', buildHash))
        .first()

      let buildId: Id<'builds'>
      let shouldDispatch = false

      if (build) {
        // Build already exists, use it
        buildId = build._id
        console.log(`Using existing build ${buildId} for hash ${buildHash}`)
      } else {
        // Check cache for existing build
        const cached = await ctx.db
          .query('buildCache')
          .withIndex('by_hash_target', (q) =>
            q.eq('buildHash', buildHash).eq('target', target)
          )
          .first()

        if (cached) {
          // Use cached artifact, create build with success status
          const artifactUrl = getR2ArtifactUrl(buildHash)
          buildId = await ctx.db.insert('builds', {
            target: target,
            githubRunId: 0,
            status: 'success',
            artifactUrl: artifactUrl,
            startedAt: Date.now(),
            completedAt: Date.now(),
            buildHash: buildHash,
          })
          console.log(`Created cached build ${buildId} for hash ${buildHash}`)
        } else {
          // Not cached, create new build and dispatch workflow
          buildId = await ctx.db.insert('builds', {
            target: target,
            githubRunId: 0,
            status: 'queued',
            startedAt: Date.now(),
            buildHash: buildHash,
          })
          shouldDispatch = true
          console.log(`Created new build ${buildId} for hash ${buildHash}`)
        }

        // Handle race condition: if another mutation created the build between our check and insert,
        // query again to get the existing build (there might be duplicates, but we'll use the first one)
        const existingBuild = await ctx.db
          .query('builds')
          .withIndex('by_hash', (q) => q.eq('buildHash', buildHash))
          .first()

        if (existingBuild && existingBuild._id !== buildId) {
          // Another mutation created the build first, use that one instead
          // Delete the duplicate we just created
          await ctx.db.delete(buildId)
          buildId = existingBuild._id
          shouldDispatch = false
          console.log(
            `Race condition detected: using existing build ${existingBuild._id} instead of duplicate`
          )
        }
      }

      // Create or update profileBuild record
      const existingProfileBuild = await ctx.db
        .query('profileBuilds')
        .withIndex('by_profile_target', (q) =>
          q.eq('profileId', args.profileId).eq('target', target)
        )
        .first()

      if (existingProfileBuild) {
        // Update existing profileBuild to point to the (possibly new) build
        await ctx.db.patch(existingProfileBuild._id, {
          buildId: buildId,
        })
      } else {
        // Create new profileBuild record
        await ctx.db.insert('profileBuilds', {
          profileId: args.profileId,
          buildId: buildId,
          target: target,
          createdAt: Date.now(),
        })
      }

      // Only dispatch GitHub workflow if build was newly created and not cached
      if (shouldDispatch) {
        await ctx.scheduler.runAfter(0, api.actions.dispatchGithubBuild, {
          buildId: buildId,
          target: target,
          flags: flagsString,
          version: profile.version,
          buildHash: buildHash,
        })
      }
    }
  },
})

export const listByProfile = query({
  args: { profileId: v.id('profiles') },
  handler: async (ctx, args) => {
    // Query profileBuilds for this profile
    const profileBuilds = await ctx.db
      .query('profileBuilds')
      .withIndex('by_profile', (q) => q.eq('profileId', args.profileId))
      .collect()

    // Get builds for each profileBuild
    const builds = await Promise.all(
      profileBuilds.map(async (pb) => {
        const build = await ctx.db.get(pb.buildId)
        return build
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
    const profileBuilds = await ctx.db
      .query('profileBuilds')
      .withIndex('by_build', (q) => q.eq('buildId', args.buildId))
      .collect()

    // Check if any of these profileBuilds link to a profile owned by the user
    for (const pb of profileBuilds) {
      const profile = await ctx.db.get(pb.profileId)
      if (profile && profile.userId === userId) {
        return build
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
    const profileBuilds = await ctx.db
      .query('profileBuilds')
      .withIndex('by_build', (q) => q.eq('buildId', args.buildId))
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
    artifactUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const build = await ctx.db.get(args.buildId)
    if (!build) return

    const updateData: BuildUpdateData = {
      status: args.status,
    }

    // Only set completedAt for final statuses
    if (args.status === 'success' || args.status === 'failure') {
      updateData.completedAt = Date.now()
    }

    if (args.artifactUrl) {
      updateData.artifactUrl = args.artifactUrl
    }

    await ctx.db.patch(args.buildId, updateData)

    // If build succeeded, store in cache with R2 URL
    if (args.status === 'success' && build.buildHash && build.target) {
      // Get version from any profileBuild linked to this build
      const profileBuilds = await ctx.db
        .query('profileBuilds')
        .withIndex('by_build', (q) => q.eq('buildId', args.buildId))
        .collect()

      if (profileBuilds.length > 0) {
        const profileBuild = profileBuilds[0]
        const profile = await ctx.db.get(profileBuild.profileId)
        if (profile) {
          // Construct R2 URL from hash
          const artifactUrl = getR2ArtifactUrl(build.buildHash)

          // Update build with R2 URL if not already set
          if (!args.artifactUrl) {
            await ctx.db.patch(args.buildId, { artifactUrl })
          }

          // Check if cache entry already exists
          const existing = await ctx.db
            .query('buildCache')
            .withIndex('by_hash_target', (q) =>
              q.eq('buildHash', build.buildHash).eq('target', build.target)
            )
            .first()

          if (!existing) {
            // Store in cache
            await ctx.db.insert('buildCache', {
              buildHash: build.buildHash,
              target: build.target,
              artifactUrl: artifactUrl,
              version: profile.version,
              createdAt: Date.now(),
            })
          }
        }
      }
    }
  },
})
