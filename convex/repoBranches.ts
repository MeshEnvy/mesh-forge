import { v } from "convex/values"
import { internal } from "./_generated/api"
import { action, internalMutation, query } from "./_generated/server"
const BRANCH_TTL_MS = 120_000

const branchEntryValidator = v.object({
  name: v.string(),
  sha: v.optional(v.string()),
})

export const get = query({
  args: { owner: v.string(), repo: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("repoBranchList")
      .withIndex("by_owner_repo", q => q.eq("owner", args.owner).eq("repo", args.repo))
      .first()
    if (!row) {
      return { row: null as null, isStale: true as const }
    }
    const isStale = Date.now() - row.fetchedAt > BRANCH_TTL_MS
    return { row, isStale }
  },
})

export const upsertFromGitHub = internalMutation({
  args: {
    owner: v.string(),
    repo: v.string(),
    defaultBranch: v.string(),
    branches: v.array(branchEntryValidator),
    etag: v.optional(v.string()),
    description: v.string(),
    homepage: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("repoBranchList")
      .withIndex("by_owner_repo", q => q.eq("owner", args.owner).eq("repo", args.repo))
      .first()
    const now = Date.now()
    const doc = {
      owner: args.owner,
      repo: args.repo,
      defaultBranch: args.defaultBranch,
      branches: args.branches,
      fetchedAt: now,
      etag: args.etag,
      description: args.description,
      homepage: args.homepage,
    }
    if (existing) {
      await ctx.db.patch(existing._id, doc)
      return existing._id
    }
    return await ctx.db.insert("repoBranchList", doc)
  },
})

export const refresh = action({
  args: { owner: v.string(), repo: v.string() },
  handler: async (ctx, args) => {
    const token = process.env.GITHUB_TOKEN
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    }
    if (token) headers.Authorization = `Bearer ${token}`

    const repoRes = await fetch(`https://api.github.com/repos/${args.owner}/${args.repo}`, { headers })
    if (!repoRes.ok) {
      throw new Error(`GitHub repo: ${repoRes.status} ${await repoRes.text()}`)
    }
    const repoJson = (await repoRes.json()) as {
      default_branch: string
      description: string | null
      homepage: string | null
    }
    const defaultBranch = repoJson.default_branch
    const description = (repoJson.description ?? "").trim()
    const homepage = (repoJson.homepage ?? "").trim()

    const branches: { name: string; sha?: string }[] = []
    let page = 1
    const perPage = 100
    while (page <= 10) {
      const br = await fetch(
        `https://api.github.com/repos/${args.owner}/${args.repo}/branches?per_page=${perPage}&page=${page}`,
        { headers }
      )
      if (!br.ok) throw new Error(`GitHub branches: ${br.status}`)
      const arr = (await br.json()) as { name: string; commit: { sha: string } }[]
      for (const b of arr) {
        branches.push({ name: b.name, sha: b.commit.sha })
      }
      if (arr.length < perPage) break
      page++
    }

    await ctx.runMutation(internal.repoBranches.upsertFromGitHub, {
      owner: args.owner,
      repo: args.repo,
      defaultBranch,
      branches,
      description,
      homepage,
    })
    return { ok: true as const, branchCount: branches.length, defaultBranch }
  },
})

export const fetchReadme = action({
  args: { owner: v.string(), repo: v.string(), ref: v.string() },
  handler: async (_ctx, args) => {
    const token = process.env.GITHUB_TOKEN
    const headers: Record<string, string> = {
      Accept: "application/vnd.github.raw+json",
      "X-GitHub-Api-Version": "2022-11-28",
    }
    if (token) headers.Authorization = `Bearer ${token}`
    const enc = encodeURIComponent(args.ref)
    const res = await fetch(
      `https://api.github.com/repos/${args.owner}/${args.repo}/readme?ref=${enc}`,
      { headers }
    )
    if (res.status === 404) return { markdown: "" as string, missing: true as const }
    if (!res.ok) throw new Error(`readme: ${res.status} ${await res.text()}`)
    const markdown = await res.text()
    return { markdown, missing: false as const }
  },
})
