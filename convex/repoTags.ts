import { v } from "convex/values"
import { internal } from "./_generated/api"
import { action, internalMutation, query } from "./_generated/server"
import { parseMeshforgeYaml, type MeshforgeConfig } from "./lib/meshforgeYaml"
import { sortTagEntries, type TagEntry } from "./lib/tagSemver"

const TAG_TTL_MS = 120_000

function decodeBase64Utf8(b64: string): string {
  const normalized = b64.replace(/\s/g, "")
  if (normalized === "") return ""
  const binary = atob(normalized)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new TextDecoder("utf-8").decode(bytes)
}

const tagEntryValidator = v.object({
  name: v.string(),
  sha: v.string(),
})

export type { TagEntry }

export const get = query({
  args: { owner: v.string(), repo: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("repoTagList")
      .withIndex("by_owner_repo", q => q.eq("owner", args.owner).eq("repo", args.repo))
      .first()
    if (!row) {
      return { row: null as null, isStale: true as const }
    }
    const isStale = Date.now() - row.fetchedAt > TAG_TTL_MS
    return { row, isStale }
  },
})

export const upsertFromGitHub = internalMutation({
  args: {
    owner: v.string(),
    repo: v.string(),
    tags: v.array(tagEntryValidator),
    etag: v.optional(v.string()),
    description: v.string(),
    homepage: v.string(),
    meshforgeConfig: v.optional(v.any()),
    defaultBranch: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("repoTagList")
      .withIndex("by_owner_repo", q => q.eq("owner", args.owner).eq("repo", args.repo))
      .first()
    const now = Date.now()
    const doc = {
      owner: args.owner,
      repo: args.repo,
      tags: args.tags,
      fetchedAt: now,
      etag: args.etag,
      description: args.description,
      homepage: args.homepage,
      meshforgeConfig: args.meshforgeConfig,
      defaultBranch: args.defaultBranch,
    }
    if (existing) {
      await ctx.db.patch(existing._id, doc)
      return existing._id
    }
    return await ctx.db.insert("repoTagList", doc)
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
      description: string | null
      homepage: string | null
      default_branch: string | null
    }
    const description = (repoJson.description ?? "").trim()
    const homepage = (repoJson.homepage ?? "").trim()
    const defaultBranch = (repoJson.default_branch ?? "").trim() || undefined

    // Fetch meshforge.yaml from the default branch (no ref = default branch).
    let meshforgeConfig: MeshforgeConfig | null = null
    const yamlRes = await fetch(
      `https://api.github.com/repos/${args.owner}/${args.repo}/contents/meshforge.yaml`,
      { headers }
    )
    if (yamlRes.ok) {
      try {
        const yamlJson = (await yamlRes.json()) as { content?: string }
        const raw = decodeBase64Utf8(yamlJson.content ?? "")
        meshforgeConfig = parseMeshforgeYaml(raw)
      } catch {
        // ignore fetch/parse errors — profile is optional
      }
    }

    const rawTags: TagEntry[] = []
    let page = 1
    const perPage = 100
    while (page <= 10) {
      const tr = await fetch(
        `https://api.github.com/repos/${args.owner}/${args.repo}/tags?per_page=${perPage}&page=${page}`,
        { headers }
      )
      if (!tr.ok) throw new Error(`GitHub tags: ${tr.status}`)
      const arr = (await tr.json()) as { name: string; commit: { sha: string } }[]
      for (const t of arr) {
        rawTags.push({ name: t.name, sha: t.commit.sha })
      }
      if (arr.length < perPage) break
      page++
    }

    const tags = sortTagEntries(rawTags)

    await ctx.runMutation(internal.repoTags.upsertFromGitHub, {
      owner: args.owner,
      repo: args.repo,
      tags,
      description,
      homepage,
      meshforgeConfig: meshforgeConfig ?? undefined,
      defaultBranch,
    })
    return { ok: true as const, tagCount: tags.length }
  },
})

export const fetchReadme = action({
  args: { owner: v.string(), repo: v.string(), ref: v.string() },
  handler: async (_ctx, args) => {
    const token = process.env.GITHUB_TOKEN
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    }
    if (token) headers.Authorization = `Bearer ${token}`
    const enc = encodeURIComponent(args.ref)
    const res = await fetch(`https://api.github.com/repos/${args.owner}/${args.repo}/readme?ref=${enc}`, { headers })
    if (res.status === 404) return { markdown: "" as string, readmeDownloadUrl: null as null, missing: true as const }
    if (!res.ok) throw new Error(`readme: ${res.status} ${await res.text()}`)
    const json = (await res.json()) as {
      content?: string
      download_url?: string | null
    }
    const b64 = json.content ?? ""
    const markdown = decodeBase64Utf8(b64)
    return {
      markdown,
      readmeDownloadUrl: (json.download_url ?? null) as string | null,
      missing: false as const,
    }
  },
})
