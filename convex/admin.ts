import { getAuthUserId } from "@convex-dev/auth/server"
import { v } from "convex/values"
import { api } from "./_generated/api"
import { query } from "./_generated/server"
import { computeFlagsFromConfig } from "./builds"
import { adminMutation, adminQuery } from "./helpers"

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

export const listFailedBuilds = adminQuery({
  args: {},
  handler: async ctx => {
    const failedBuilds = await ctx.db
      .query("builds")
      .filter(q => q.eq(q.field("status"), "failure"))
      .order("desc")
      .collect()

    return failedBuilds
  },
})

export const listAllBuilds = adminQuery({
  args: {},
  handler: async ctx => {
    const allBuilds = await ctx.db.query("builds").order("desc").collect()

    return allBuilds
  },
})

export const retryBuild = adminMutation({
  args: {
    buildId: v.id("builds"),
  },
  handler: async (ctx, args) => {
    const build = await ctx.db.get(args.buildId)
    if (!build) {
      throw new Error("Build not found")
    }

    // Compute flags from config
    const flags = computeFlagsFromConfig(build.config)

    // Dispatch new GitHub build with same config
    // This will use the latest YAML from the branch
    await ctx.scheduler.runAfter(0, api.actions.dispatchGithubBuild, {
      target: build.config.target,
      version: build.config.version,
      buildId: args.buildId,
      flags,
      buildHash: build.buildHash,
      plugins: build.config.pluginsEnabled ?? [],
    })

    // Update build status to queued and clear artifact paths
    await ctx.db.patch(args.buildId, {
      status: "queued",
      updatedAt: Date.now(),
      firmwarePath: undefined,
      sourcePath: undefined,
    })

    return { success: true }
  },
})
