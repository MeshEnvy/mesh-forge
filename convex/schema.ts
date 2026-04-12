import { authTables } from "@convex-dev/auth/server"
import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

export const repoTagListFields = {
  owner: v.string(),
  repo: v.string(),
  /** Tag names + commit SHAs, SemVer-descending then non-SemVer reverse lexicographic (see convex/repoTags). */
  tags: v.array(
    v.object({
      name: v.string(),
      sha: v.string(),
    })
  ),
  fetchedAt: v.number(),
  etag: v.optional(v.string()),
  /** GitHub REST `description` (About blurb), not README. */
  description: v.optional(v.string()),
  /** GitHub REST `homepage` (often meshtastic.org–style URL). */
  homepage: v.optional(v.string()),
  /** Parsed meshforge.yaml from the repo's default branch, if present. */
  meshforgeConfig: v.optional(v.any()),
  /** GitHub's configured default branch (e.g. "main", "master"). Used as fallback when repo has no tags. */
  defaultBranch: v.optional(v.string()),
}

export const repoRefScanFields = {
  owner: v.string(),
  repo: v.string(),
  resolvedSourceSha: v.string(),
  scanStatus: v.union(v.literal("in_progress"), v.literal("complete"), v.literal("failed")),
  envNames: v.optional(v.array(v.string())),
  grouped: v.optional(v.any()),
  /** Detected capability sets keyed by env name, e.g. { "LilyGo_TDeck_repeater": ["wifi","ble"] }. */
  envCapabilities: v.optional(v.any()),
  /** Parsed meshforge.yaml config from the scanned source tree, if present. */
  meshforgeConfig: v.optional(v.any()),
  scanError: v.optional(v.string()),
  scannedAt: v.optional(v.number()),
  scanRunnerRequestId: v.optional(v.string()),
  scanProgressUrl: v.optional(v.string()),
  githubRunId: v.optional(v.number()),
  updatedAt: v.number(),
}

export const repoBuildsFields = {
  owner: v.string(),
  repo: v.string(),
  ref: v.string(),
  resolvedSourceSha: v.string(),
  targetEnv: v.string(),
  buildKey: v.string(),
  status: v.union(v.literal("queued"), v.literal("running"), v.literal("succeeded"), v.literal("failed")),
  startedAt: v.number(),
  updatedAt: v.number(),
  completedAt: v.optional(v.number()),
  githubRunId: v.optional(v.number()),
  r2ObjectKey: v.optional(v.string()),
  errorSummary: v.optional(v.string()),
  /** CI workflow progress (1-based step / total + label), pushed via /ingest-repo-build-progress. */
  ciProgressStep: v.optional(v.number()),
  ciProgressTotal: v.optional(v.number()),
  ciProgressLabel: v.optional(v.string()),
}

export const deviceReportFields = {
  owner: v.string(),
  repo: v.string(),
  resolvedSourceSha: v.string(),
  targetEnv: v.string(),
  works: v.boolean(),
  userId: v.optional(v.id("users")),
  createdAt: v.number(),
}

export const userSettingsFields = {
  userId: v.id("users"),
  isAdmin: v.boolean(),
}

export const schema = defineSchema({
  ...authTables,
  repoTagList: defineTable(repoTagListFields).index("by_owner_repo", ["owner", "repo"]),
  repoRefScan: defineTable(repoRefScanFields).index("by_repo_sha", ["owner", "repo", "resolvedSourceSha"]),
  repoBuilds: defineTable(repoBuildsFields)
    .index("by_buildKey", ["buildKey"])
    .index("by_owner_repo", ["owner", "repo"])
    .index("by_status", ["status"])
    .index("by_status_updatedAt", ["status", "updatedAt"]),
  deviceReports: defineTable(deviceReportFields).index("by_repo_sha_target", [
    "owner",
    "repo",
    "resolvedSourceSha",
    "targetEnv",
  ]),
  userSettings: defineTable(userSettingsFields).index("by_user", ["userId"]),
})

export default schema
