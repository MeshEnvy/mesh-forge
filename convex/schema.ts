import { authTables } from '@convex-dev/auth/server'
import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  ...authTables,
  profiles: defineTable({
    userId: v.id('users'),
    name: v.string(),
    description: v.string(),
    config: v.any(), // JSON object for flags
    version: v.string(),
    updatedAt: v.number(),
    isPublic: v.optional(v.boolean()),
  })
    .index('by_user', ['userId'])
    .index('by_public', ['isPublic']),

  builds: defineTable({
    target: v.string(),
    githubRunId: v.number(),
    status: v.string(), // Accepts arbitrary status strings (e.g., "queued", "checking_out", "building", "uploading", "success", "failure")
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    buildHash: v.string(),
    artifactPath: v.optional(v.string()), // Path to artifact in R2 (e.g., "/abc123.uf2" or "/abc123.bin")
  }).index('by_hash', ['buildHash']),

  profileBuilds: defineTable({
    profileId: v.id('profiles'),
    buildId: v.id('builds'),
  })
    .index('by_profile', ['profileId'])
    .index('by_build', ['buildId']),
})
