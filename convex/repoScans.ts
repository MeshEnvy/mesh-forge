import { v } from "convex/values"
import { api, internal } from "./_generated/api"
import type { MutationCtx } from "./_generated/server"
import { action, internalMutation, mutation, query } from "./_generated/server"

async function findRepoRefScan(
  ctx: Pick<MutationCtx, "db">,
  args: { owner: string; repo: string; resolvedSourceSha: string; platformRoot: string }
) {
  const pr = args.platformRoot
  let existing = await ctx.db
    .query("repoRefScan")
    .withIndex("by_repo_sha_platform", q =>
      q
        .eq("owner", args.owner)
        .eq("repo", args.repo)
        .eq("resolvedSourceSha", args.resolvedSourceSha)
        .eq("platformRoot", pr)
    )
    .first()
  if (!existing && pr === "") {
    existing = await ctx.db
      .query("repoRefScan")
      .withIndex("by_repo_sha", q =>
        q.eq("owner", args.owner).eq("repo", args.repo).eq("resolvedSourceSha", args.resolvedSourceSha)
      )
      .first()
  }
  return existing
}

export const getByRepoSha = query({
  args: {
    owner: v.string(),
    repo: v.string(),
    resolvedSourceSha: v.string(),
    platformRoot: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const pr = args.platformRoot ?? ""
    let row = await ctx.db
      .query("repoRefScan")
      .withIndex("by_repo_sha_platform", q =>
        q
          .eq("owner", args.owner)
          .eq("repo", args.repo)
          .eq("resolvedSourceSha", args.resolvedSourceSha)
          .eq("platformRoot", pr)
      )
      .first()
    if (!row && pr === "") {
      row = await ctx.db
        .query("repoRefScan")
        .withIndex("by_repo_sha", q =>
          q.eq("owner", args.owner).eq("repo", args.repo).eq("resolvedSourceSha", args.resolvedSourceSha)
        )
        .first()
    }
    return row
  },
})

export const resolveRefToSha = action({
  args: { owner: v.string(), repo: v.string(), ref: v.string() },
  handler: async (_ctx, args) => {
    const token = process.env.GITHUB_TOKEN
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    }
    if (token) headers.Authorization = `Bearer ${token}`
    const enc = encodeURIComponent(args.ref)
    const res = await fetch(`https://api.github.com/repos/${args.owner}/${args.repo}/commits/${enc}`, {
      headers,
    })
    if (!res.ok) {
      throw new Error(`resolve ref: ${res.status} ${await res.text()}`)
    }
    const j = (await res.json()) as { sha: string }
    return j.sha
  },
})

export const ensureScan = mutation({
  args: {
    owner: v.string(),
    repo: v.string(),
    ref: v.string(),
    resolvedSourceSha: v.string(),
    platformRoot: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const platformRoot = args.platformRoot ?? ""
    const existing = await findRepoRefScan(ctx, {
      owner: args.owner,
      repo: args.repo,
      resolvedSourceSha: args.resolvedSourceSha,
      platformRoot,
    })

    if (existing?.scanStatus === "complete") {
      const names = existing.envNames ?? []
      const caps = existing.envCapabilities as Record<string, unknown> | undefined
      const capsComplete =
        caps != null &&
        typeof caps === "object" &&
        (names.length === 0 || names.every(n => Array.isArray(caps[n])))
      if (capsComplete) {
        return { scanId: existing._id, status: "complete" as const }
      }
      await ctx.db.patch(existing._id, {
        scanStatus: "in_progress",
        envNames: undefined,
        grouped: undefined,
        envCapabilities: undefined,
        meshforgeConfig: undefined,
        scanError: undefined,
        updatedAt: Date.now(),
        platformRoot: existing.platformRoot ?? platformRoot,
      })
      await ctx.scheduler.runAfter(0, api.repoScanGitAction.runArchiveScan, {
        scanId: existing._id,
        owner: args.owner,
        repo: args.repo,
        ref: args.ref,
        resolvedSourceSha: args.resolvedSourceSha,
        platformRoot,
      })
      return { scanId: existing._id, status: "in_progress" as const }
    }
    if (existing?.scanStatus === "in_progress") {
      return { scanId: existing._id, status: "in_progress" as const }
    }
    if (existing?.scanStatus === "failed") {
      await ctx.db.patch(existing._id, {
        scanStatus: "in_progress",
        envNames: undefined,
        grouped: undefined,
        envCapabilities: undefined,
        meshforgeConfig: undefined,
        scanError: undefined,
        updatedAt: Date.now(),
        platformRoot: existing.platformRoot ?? platformRoot,
      })
      await ctx.scheduler.runAfter(0, api.repoScanGitAction.runArchiveScan, {
        scanId: existing._id,
        owner: args.owner,
        repo: args.repo,
        ref: args.ref,
        resolvedSourceSha: args.resolvedSourceSha,
        platformRoot,
      })
      return { scanId: existing._id, status: "in_progress" as const }
    }

    const scanId = await ctx.db.insert("repoRefScan", {
      owner: args.owner,
      repo: args.repo,
      resolvedSourceSha: args.resolvedSourceSha,
      platformRoot,
      scanStatus: "in_progress",
      updatedAt: Date.now(),
    })

    await ctx.scheduler.runAfter(0, api.repoScanGitAction.runArchiveScan, {
      scanId,
      owner: args.owner,
      repo: args.repo,
      ref: args.ref,
      resolvedSourceSha: args.resolvedSourceSha,
      platformRoot,
    })

    return { scanId, status: "in_progress" as const }
  },
})

export const completeScanInternal = internalMutation({
  args: {
    scanId: v.id("repoRefScan"),
    envNames: v.array(v.string()),
    grouped: v.any(),
    envCapabilities: v.any(),
    meshforgeConfig: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.scanId, {
      scanStatus: "complete",
      envNames: args.envNames,
      grouped: args.grouped,
      envCapabilities: args.envCapabilities,
      meshforgeConfig: args.meshforgeConfig,
      scannedAt: Date.now(),
      updatedAt: Date.now(),
      scanError: undefined,
    })
  },
})

export const failScanInternal = internalMutation({
  args: {
    scanId: v.id("repoRefScan"),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.scanId, {
      scanStatus: "failed",
      scanError: args.message,
      updatedAt: Date.now(),
    })
  },
})
