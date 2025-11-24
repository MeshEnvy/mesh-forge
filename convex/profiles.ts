import { getAuthUserId } from '@convex-dev/auth/server'
import { v } from 'convex/values'
import { mutation, query } from './_generated/server'

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
    const profileTargets = await ctx.db
      .query('profileTargets')
      .withIndex('by_profile', (q) => q.eq('profileId', args.profileId))
      .collect()
    return profileTargets.map((pt) => pt.target)
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
      config: args.config,
      version: args.version,
      updatedAt: Date.now(),
      isPublic: args.isPublic ?? true,
    })

    // Create profileTargets entries
    if (args.targets) {
      for (const target of args.targets) {
        await ctx.db.insert('profileTargets', {
          profileId,
          target,
          createdAt: Date.now(),
        })
      }
    }

    return profileId
  },
})

export const update = mutation({
  args: {
    id: v.id('profiles'),
    name: v.string(),
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
      config: args.config,
      version: args.version,
      isPublic: args.isPublic,
      updatedAt: Date.now(),
    })

    // Sync profileTargets if targets are provided
    if (args.targets !== undefined) {
      const newTargets = new Set(args.targets)

      const existingProfileTargets = await ctx.db
        .query('profileTargets')
        .withIndex('by_profile', (q) => q.eq('profileId', args.id))
        .collect()

      const existingTargets = new Set(
        existingProfileTargets.map((pt) => pt.target)
      )

      // Delete targets that are no longer in the list
      for (const profileTarget of existingProfileTargets) {
        if (!newTargets.has(profileTarget.target)) {
          await ctx.db.delete(profileTarget._id)
        }
      }

      // Add new targets
      for (const target of args.targets) {
        if (!existingTargets.has(target)) {
          await ctx.db.insert('profileTargets', {
            profileId: args.id,
            target,
            createdAt: Date.now(),
          })
        }
      }
    }
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

    // Delete associated profileTargets
    const profileTargets = await ctx.db
      .query('profileTargets')
      .withIndex('by_profile', (q) => q.eq('profileId', args.id))
      .collect()

    for (const profileTarget of profileTargets) {
      await ctx.db.delete(profileTarget._id)
    }

    await ctx.db.delete(args.id)
  },
})
