import { unzipSync, strFromU8 } from "fflate"
import { v } from "convex/values"
import { api, internal } from "./_generated/api"
import { collectPlatformioEnvsFromFiles, normalizeZipPaths } from "./lib/platformioScan"
import { action, internalMutation, mutation, query } from "./_generated/server"

export const getByRepoSha = query({
  args: {
    owner: v.string(),
    repo: v.string(),
    resolvedSourceSha: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("repoRefScan")
      .withIndex("by_repo_sha", q =>
        q.eq("owner", args.owner).eq("repo", args.repo).eq("resolvedSourceSha", args.resolvedSourceSha)
      )
      .first()
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
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("repoRefScan")
      .withIndex("by_repo_sha", q =>
        q.eq("owner", args.owner).eq("repo", args.repo).eq("resolvedSourceSha", args.resolvedSourceSha)
      )
      .first()

    if (existing?.scanStatus === "complete") {
      return { scanId: existing._id, status: "complete" as const }
    }
    if (existing?.scanStatus === "in_progress") {
      return { scanId: existing._id, status: "in_progress" as const }
    }
    if (existing?.scanStatus === "failed") {
      return { scanId: existing._id, status: "failed" as const }
    }

    const scanId = await ctx.db.insert("repoRefScan", {
      owner: args.owner,
      repo: args.repo,
      resolvedSourceSha: args.resolvedSourceSha,
      scanStatus: "in_progress",
      updatedAt: Date.now(),
    })

    await ctx.scheduler.runAfter(0, api.repoScans.runArchiveScan, {
      scanId,
      owner: args.owner,
      repo: args.repo,
      ref: args.ref,
      resolvedSourceSha: args.resolvedSourceSha,
    })

    return { scanId, status: "in_progress" as const }
  },
})

export const completeScanInternal = internalMutation({
  args: {
    scanId: v.id("repoRefScan"),
    envNames: v.array(v.string()),
    grouped: v.any(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.scanId, {
      scanStatus: "complete",
      envNames: args.envNames,
      grouped: args.grouped,
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

export const runArchiveScan = action({
  args: {
    scanId: v.id("repoRefScan"),
    owner: v.string(),
    repo: v.string(),
    ref: v.string(),
    resolvedSourceSha: v.string(),
  },
  handler: async (ctx, args) => {
    const token = process.env.GITHUB_TOKEN
    const zipUrl = `https://codeload.github.com/${args.owner}/${args.repo}/zip/${encodeURIComponent(args.ref)}`
    const headers: Record<string, string> = {}
    if (token) headers.Authorization = `Bearer ${token}`

    try {
      const zipRes = await fetch(zipUrl, { headers, redirect: "follow" })
      if (!zipRes.ok) {
        throw new Error(`Archive fetch ${zipRes.status}: ${await zipRes.text()}`)
      }
      const buf = new Uint8Array(await zipRes.arrayBuffer())
      if (buf.byteLength > 80 * 1024 * 1024) {
        throw new Error("Archive too large for inline scan (max 80MB)")
      }
      const files = unzipSync(buf)
      const virtual = normalizeZipPaths(files, u => strFromU8(u, true))
      const { envNames, grouped } = collectPlatformioEnvsFromFiles(virtual)
      await ctx.runMutation(internal.repoScans.completeScanInternal, {
        scanId: args.scanId,
        envNames,
        grouped,
      })
    } catch (e) {
      await ctx.runMutation(internal.repoScans.failScanInternal, {
        scanId: args.scanId,
        message: String(e),
      })
    }
  },
})
