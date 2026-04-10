import { getAuthUserId } from "@convex-dev/auth/server"
import { ConvexError, v } from "convex/values"
import { mutation, query } from "./_generated/server"

export const submit = mutation({
  args: {
    owner: v.string(),
    repo: v.string(),
    resolvedSourceSha: v.string(),
    targetEnv: v.string(),
    works: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) {
      throw new ConvexError("Sign in to report compatibility")
    }
    const now = Date.now()
    const rows = await ctx.db
      .query("deviceReports")
      .withIndex("by_repo_sha_target", q =>
        q
          .eq("owner", args.owner)
          .eq("repo", args.repo)
          .eq("resolvedSourceSha", args.resolvedSourceSha)
          .eq("targetEnv", args.targetEnv)
      )
      .collect()
    const existing = rows.find(r => r.userId === userId)
    if (existing) {
      await ctx.db.patch(existing._id, { works: args.works, createdAt: now })
      return existing._id
    }
    return await ctx.db.insert("deviceReports", {
      owner: args.owner,
      repo: args.repo,
      resolvedSourceSha: args.resolvedSourceSha,
      targetEnv: args.targetEnv,
      works: args.works,
      userId,
      createdAt: now,
    })
  },
})

export const aggregatesForTarget = query({
  args: {
    owner: v.string(),
    repo: v.string(),
    resolvedSourceSha: v.string(),
    targetEnv: v.string(),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("deviceReports")
      .withIndex("by_repo_sha_target", q =>
        q
          .eq("owner", args.owner)
          .eq("repo", args.repo)
          .eq("resolvedSourceSha", args.resolvedSourceSha)
          .eq("targetEnv", args.targetEnv)
      )
      .collect()
    let works = 0
    let notWorks = 0
    for (const r of rows) {
      if (r.works) works++
      else notWorks++
    }
    return { works, notWorks, total: rows.length }
  },
})
