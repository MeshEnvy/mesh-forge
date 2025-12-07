import { getAuthUserId } from "@convex-dev/auth/server"
import { customAction, customCtx, customMutation, customQuery } from "convex-helpers/server/customFunctions"
import { ConvexError, v } from "convex/values"
import { api } from "./_generated/api"
import { action, mutation, query } from "./_generated/server"

export const authQuery = customQuery(
  query,
  customCtx(async ctx => {
    const identity = await ctx.auth.getUserIdentity()
    if (identity === null) {
      throw new ConvexError("Not authenticated!")
    }
    return {}
  })
)

export const authMutation = customMutation(
  mutation,
  customCtx(async ctx => {
    const identity = await ctx.auth.getUserIdentity()
    if (identity === null) {
      throw new ConvexError("Not authenticated!")
    }
    return {}
  })
)

export const authAction = customAction(
  action,
  customCtx(async ctx => {
    const identity = await ctx.auth.getUserIdentity()
    if (identity === null) {
      throw new ConvexError("Not authenticated!")
    }
    return {}
  })
)

export const adminQuery = customQuery(
  query,
  customCtx(async ctx => {
    const userId = await getAuthUserId(ctx)
    if (!userId) {
      throw new ConvexError("Not authenticated!")
    }

    const userSettings = await ctx.db
      .query("userSettings")
      .withIndex("by_user", q => q.eq("userId", userId))
      .first()

    if (userSettings?.isAdmin !== true) {
      throw new ConvexError("Unauthorized: Admin access required")
    }

    return {}
  })
)

export const adminMutation = customMutation(
  mutation,
  customCtx(async ctx => {
    const userId = await getAuthUserId(ctx)
    if (!userId) {
      throw new ConvexError("Not authenticated!")
    }

    const userSettings = await ctx.db
      .query("userSettings")
      .withIndex("by_user", q => q.eq("userId", userId))
      .first()

    if (userSettings?.isAdmin !== true) {
      throw new ConvexError("Unauthorized: Admin access required")
    }

    return {}
  })
)

export const adminAction = customAction(
  action,
  customCtx(async ctx => {
    const userId = await getAuthUserId(ctx)
    if (!userId) {
      throw new ConvexError("Not authenticated!")
    }

    // Actions can't access ctx.db directly, so we need to use a query
    const isAdmin = await ctx.runQuery(api.helpers.checkIsAdmin, {
      userId,
    })
    if (!isAdmin) {
      throw new ConvexError("Unauthorized: Admin access required")
    }

    return {}
  })
)

// Internal query to check if user is admin (used by action middleware)
export const checkIsAdmin = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const userSettings = await ctx.db
      .query("userSettings")
      .withIndex("by_user", q => q.eq("userId", args.userId))
      .first()

    return userSettings?.isAdmin === true
  },
})
