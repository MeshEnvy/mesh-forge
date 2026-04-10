import { getAuthUserId } from "@convex-dev/auth/server"
import { v } from "convex/values"
import { adminMutation, adminQuery } from "./helpers"
import { query } from "./_generated/server"

export const isAdmin = query({
  args: {},
  handler: async ctx => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return false
    const userSettings = await ctx.db
      .query("userSettings")
      .withIndex("by_user", q => q.eq("userId", userId))
      .first()
    return userSettings?.isAdmin === true
  },
})

export const listFailedRepoBuilds = adminQuery({
  args: {},
  handler: async ctx => {
    const failed = await ctx.db
      .query("repoBuilds")
      .withIndex("by_status_updatedAt", q => q.eq("status", "failed"))
      .order("desc")
      .take(100)
    return failed
  },
})

export const listFailedRepoScans = adminQuery({
  args: {},
  handler: async ctx => {
    const rows = await ctx.db.query("repoRefScan").collect()
    return rows
      .filter(r => r.scanStatus === "failed")
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 50)
  },
})

export const deleteRepoBuild = adminMutation({
  args: { buildId: v.id("repoBuilds") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.buildId)
    return { ok: true as const }
  },
})

export const deleteFailedScan = adminMutation({
  args: { scanId: v.id("repoRefScan") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.scanId)
    return { ok: true as const }
  },
})
