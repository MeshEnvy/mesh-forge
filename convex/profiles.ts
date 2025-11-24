import { getAuthUserId } from '@convex-dev/auth/server'
import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { getR2ArtifactUrl } from './builds'

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return []

    return await ctx.db
      .query('profiles')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect()
  },
})

export const listPublic = query({
  args: {},
  handler: async (ctx) => {
    // Get all profiles and filter for public ones (isPublic === true or undefined)
    // Note: Index query with optional field may not work as expected, so we filter manually
    const allProfiles = await ctx.db.query('profiles').collect()
    return allProfiles.filter((p) => p.isPublic !== false)
  },
})

export const get = query({
  args: { id: v.id('profiles') },
  handler: async (ctx, args) => {
    const profile = await ctx.db.get(args.id)
    if (!profile) return null
    // Treat undefined as public (backward compatibility)
    if (profile.isPublic === false) {
      // Check if user owns this profile
      const userId = await getAuthUserId(ctx)
      if (!userId || profile.userId !== userId) {
        return null
      }
    }
    return profile
  },
})

export const getTargets = query({
  args: { profileId: v.id('profiles') },
  handler: async (ctx, args) => {
    const profileBuilds = await ctx.db
      .query('profileBuilds')
      .withIndex('by_profile', (q) => q.eq('profileId', args.profileId))
      .collect()
    // Get unique targets from builds
    const builds = await Promise.all(
      profileBuilds.map((pb) => ctx.db.get(pb.buildId))
    )
    const targets = new Set(
      builds
        .filter((b): b is NonNullable<typeof b> => b !== null)
        .map((b) => b.target)
    )
    return Array.from(targets)
  },
})

export const getProfileTarget = query({
  args: {
    profileId: v.id('profiles'),
    target: v.string(),
  },
  handler: async (ctx, args) => {
    // Get all profileBuilds for this profile
    const profileBuilds = await ctx.db
      .query('profileBuilds')
      .withIndex('by_profile', (q) => q.eq('profileId', args.profileId))
      .collect()

    // Find the profileBuild with matching target by checking the build
    for (const profileBuild of profileBuilds) {
      const build = await ctx.db.get(profileBuild.buildId)
      if (build?.target === args.target) {
        return {
          profileBuild,
          build: {
            ...build,
            artifactUrl: getR2ArtifactUrl(build),
          },
        }
      }
    }

    return null
  },
})

export const getFlashCount = query({
  args: { profileId: v.id('profiles') },
  handler: async (ctx, args) => {
    const profileBuilds = await ctx.db
      .query('profileBuilds')
      .withIndex('by_profile', (q) => q.eq('profileId', args.profileId))
      .collect()

    let successCount = 0
    for (const profileBuild of profileBuilds) {
      const build = await ctx.db.get(profileBuild.buildId)
      if (build && build.status === 'success') {
        successCount++
      }
    }
    return successCount
  },
})

export const create = mutation({
  args: {
    name: v.string(),
    description: v.string(),
    targets: v.optional(v.array(v.string())),
    config: v.any(),
    version: v.string(),
    isPublic: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error('Unauthorized')

    const profileId = await ctx.db.insert('profiles', {
      userId,
      name: args.name,
      description: args.description,
      config: args.config,
      version: args.version,
      updatedAt: Date.now(),
      isPublic: args.isPublic ?? true,
    })

    // Note: targets are now tracked via profileBuilds when builds are triggered
    // No need to create profileTargets entries

    return profileId
  },
})

export const update = mutation({
  args: {
    id: v.id('profiles'),
    name: v.string(),
    description: v.string(),
    targets: v.optional(v.array(v.string())),
    config: v.any(),
    version: v.optional(v.string()),
    isPublic: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error('Unauthorized')

    const profile = await ctx.db.get(args.id)
    if (!profile || profile.userId !== userId) {
      throw new Error('Unauthorized')
    }

    // Update profile
    await ctx.db.patch(args.id, {
      name: args.name,
      description: args.description,
      config: args.config,
      version: args.version,
      isPublic: args.isPublic,
      updatedAt: Date.now(),
    })

    // Note: targets are now tracked via profileBuilds when builds are triggered
    // No need to sync profileTargets
  },
})

export const remove = mutation({
  args: { id: v.id('profiles') },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error('Unauthorized')

    const profile = await ctx.db.get(args.id)
    if (!profile || profile.userId !== userId) {
      throw new Error('Unauthorized')
    }

    // Delete associated profileBuilds
    const profileBuilds = await ctx.db
      .query('profileBuilds')
      .withIndex('by_profile', (q) => q.eq('profileId', args.id))
      .collect()

    for (const profileBuild of profileBuilds) {
      await ctx.db.delete(profileBuild._id)
    }

    await ctx.db.delete(args.id)
  },
})
