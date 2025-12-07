import { getAuthUserId } from "@convex-dev/auth/server"
import { v } from "convex/values"
import { internalMutation, mutation, query } from "./_generated/server"
import { buildConfigFields } from "./schema"

export const list = query({
  args: {},
  handler: async ctx => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return []

    return await ctx.db
      .query("profiles")
      .filter(q => q.eq(q.field("userId"), userId))
      .collect()
  },
})

export const listPublic = query({
  args: {},
  handler: async ctx => {
    const allProfiles = await ctx.db
      .query("profiles")
      .filter(q => q.eq(q.field("isPublic"), true))
      .collect()
    return allProfiles.sort((a, b) => (b.flashCount ?? 0) - (a.flashCount ?? 0))
  },
})

export const get = query({
  args: { id: v.id("profiles") },
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

// Internal mutation to get a build by ID
export const getBuildById = internalMutation({
  args: { buildId: v.id("builds") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.buildId)
  },
})

export const recordFlash = mutation({
  args: {
    profileId: v.id("profiles"),
  },
  handler: async (ctx, args) => {
    const profile = await ctx.db.get(args.profileId)
    if (!profile) {
      throw new Error("Profile not found")
    }

    const nextCount = (profile.flashCount ?? 0) + 1

    await ctx.db.patch(args.profileId, {
      flashCount: nextCount,
      updatedAt: Date.now(),
    })

    return nextCount
  },
})

export const upsert = mutation({
  args: {
    id: v.optional(v.id("profiles")),
    name: v.string(),
    description: v.string(),
    config: v.object(buildConfigFields),
    isPublic: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Unauthorized")

    if (args.id) {
      // Update existing profile
      const profile = await ctx.db.get(args.id)
      if (!profile || profile.userId !== userId) {
        throw new Error("Unauthorized")
      }

      await ctx.db.patch(args.id, {
        name: args.name,
        description: args.description,
        config: args.config,
        isPublic: args.isPublic,
        flashCount: profile.flashCount ?? 0,
        updatedAt: Date.now(),
      })

      return args.id
    } else {
      // Create new profile
      const profileId = await ctx.db.insert("profiles", {
        userId,
        name: args.name,
        description: args.description,
        config: args.config,
        flashCount: 0,
        updatedAt: Date.now(),
        isPublic: args.isPublic ?? true,
      })

      return profileId
    }
  },
})

export const remove = mutation({
  args: { id: v.id("profiles") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Unauthorized")

    const profile = await ctx.db.get(args.id)
    if (!profile || profile.userId !== userId) {
      throw new Error("Unauthorized")
    }

    await ctx.db.delete(args.id)
  },
})
