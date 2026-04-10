import { v } from "convex/values"
import { api, internal } from "./_generated/api"
import { internalMutation, internalQuery, mutation, query } from "./_generated/server"

export function normalizeBuildKey(resolvedSourceSha: string, targetEnv: string): string {
  const t = targetEnv.replace(/\//g, "_")
  return `${resolvedSourceSha}_${t}`
}

export const getById = query({
  args: { id: v.id("repoBuilds") },
  handler: async (ctx, args) => ctx.db.get(args.id),
})

export const getByIdInternal = internalQuery({
  args: { id: v.id("repoBuilds") },
  handler: async (ctx, args) => ctx.db.get(args.id),
})

export const getByBuildKey = query({
  args: { buildKey: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("repoBuilds")
      .withIndex("by_buildKey", q => q.eq("buildKey", args.buildKey))
      .first()
  },
})

export const ensureBuild = mutation({
  args: {
    owner: v.string(),
    repo: v.string(),
    ref: v.string(),
    resolvedSourceSha: v.string(),
    targetEnv: v.string(),
  },
  handler: async (ctx, args) => {
    const buildKey = normalizeBuildKey(args.resolvedSourceSha, args.targetEnv)
    const existing = await ctx.db
      .query("repoBuilds")
      .withIndex("by_buildKey", q => q.eq("buildKey", buildKey))
      .first()

    if (existing) {
      if (existing.status === "failed") {
        return { buildId: existing._id, status: "failed" as const, reused: true as const }
      }
      if (existing.status === "succeeded") {
        return { buildId: existing._id, status: "succeeded" as const, reused: true as const }
      }
      if (existing.status === "queued" || existing.status === "running") {
        return { buildId: existing._id, status: existing.status, reused: true as const }
      }
    }

    const now = Date.now()
    const buildId = await ctx.db.insert("repoBuilds", {
      owner: args.owner,
      repo: args.repo,
      ref: args.ref,
      resolvedSourceSha: args.resolvedSourceSha,
      targetEnv: args.targetEnv,
      buildKey,
      status: "queued",
      startedAt: now,
      updatedAt: now,
    })

    await ctx.scheduler.runAfter(0, api.actions.dispatchRepoBuild, { buildId })

    return { buildId, status: "queued" as const, reused: false as const }
  },
})

export const patchFromWebhook = internalMutation({
  args: {
    buildId: v.id("repoBuilds"),
    status: v.union(v.literal("running"), v.literal("succeeded"), v.literal("failed")),
    githubRunId: v.optional(v.number()),
    r2ObjectKey: v.optional(v.string()),
    errorSummary: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const patch: Record<string, unknown> = {
      status: args.status,
      updatedAt: Date.now(),
    }
    if (args.githubRunId !== undefined) patch.githubRunId = args.githubRunId
    if (args.r2ObjectKey !== undefined) patch.r2ObjectKey = args.r2ObjectKey
    if (args.errorSummary !== undefined) patch.errorSummary = args.errorSummary
    if (args.status === "succeeded" || args.status === "failed") {
      patch.completedAt = Date.now()
      patch.ciProgressStep = undefined
      patch.ciProgressTotal = undefined
      patch.ciProgressLabel = undefined
    }
    await ctx.db.patch(args.buildId, patch)
  },
})

export const patchCiProgress = internalMutation({
  args: {
    buildId: v.id("repoBuilds"),
    stepIndex: v.number(),
    stepTotal: v.number(),
    label: v.string(),
  },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.buildId)
    if (!doc) {
      return
    }
    if (doc.status === "succeeded" || doc.status === "failed") {
      return
    }
    if (args.stepTotal < 1 || args.stepIndex < 1 || args.stepIndex > args.stepTotal) {
      return
    }
    await ctx.db.patch(args.buildId, {
      ciProgressStep: args.stepIndex,
      ciProgressTotal: args.stepTotal,
      ciProgressLabel: args.label,
      updatedAt: Date.now(),
    })
  },
})

export const logBuildDispatchError = internalMutation({
  args: { buildId: v.id("repoBuilds"), message: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.buildId, {
      status: "failed",
      errorSummary: args.message,
      updatedAt: Date.now(),
      completedAt: Date.now(),
      ciProgressStep: undefined,
      ciProgressTotal: undefined,
      ciProgressLabel: undefined,
    })
  },
})

/** Re-queue a failed build (same Convex doc + webhook id) after dispatch or CI flakiness. */
export const retryBuild = mutation({
  args: { buildId: v.id("repoBuilds") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.buildId)
    if (!doc) {
      throw new Error("Build not found")
    }
    if (doc.status !== "failed") {
      throw new Error(`Cannot retry unless status is failed (got ${doc.status})`)
    }

    const now = Date.now()
    await ctx.db.replace(args.buildId, {
      owner: doc.owner,
      repo: doc.repo,
      ref: doc.ref,
      resolvedSourceSha: doc.resolvedSourceSha,
      targetEnv: doc.targetEnv,
      buildKey: doc.buildKey,
      status: "queued",
      startedAt: now,
      updatedAt: now,
    })

    await ctx.scheduler.runAfter(0, api.actions.dispatchRepoBuild, { buildId: args.buildId })
    return { ok: true as const }
  },
})
