import { authTables } from '@convex-dev/auth/server'
import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  ...authTables,
  profiles: defineTable({
    userId: v.id('users'),
    name: v.string(),
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
    artifactUrl: v.optional(v.string()),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    buildHash: v.string(),
  }).index('by_hash', ['buildHash']),

  profileTargets: defineTable({
    profileId: v.id('profiles'),
    target: v.string(),
    createdAt: v.number(),
  })
    .index('by_profile', ['profileId'])
    .index('by_profile_target', ['profileId', 'target']),

  profileBuilds: defineTable({
    profileId: v.id('profiles'),
    buildId: v.id('builds'),
    target: v.string(),
    createdAt: v.number(),
  })
    .index('by_profile', ['profileId'])
    .index('by_build', ['buildId'])
    .index('by_profile_target', ['profileId', 'target']),

  buildCache: defineTable({
    buildHash: v.string(),
    target: v.string(),
    artifactUrl: v.string(),
    version: v.string(),
    createdAt: v.number(),
  }).index('by_hash_target', ['buildHash', 'target']),
})
