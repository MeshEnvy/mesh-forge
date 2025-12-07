import { authTables } from "@convex-dev/auth/server"
import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

export const buildConfigFields = {
  version: v.string(),
  modulesExcluded: v.record(v.string(), v.boolean()),
  target: v.string(),
  pluginsEnabled: v.optional(v.array(v.string())),
}

export const profileFields = {
  userId: v.id("users"),
  name: v.string(),
  description: v.string(),
  config: v.object(buildConfigFields),
  isPublic: v.boolean(),
  flashCount: v.number(),
  updatedAt: v.number(),
}

export const buildFields = {
  buildHash: v.string(),
  status: v.string(),
  startedAt: v.number(),
  updatedAt: v.number(),
  config: v.object(buildConfigFields),

  // Optional props
  completedAt: v.optional(v.number()),
  artifactPath: v.optional(v.string()), // Deprecated
  firmwarePath: v.optional(v.string()),
  sourceUrl: v.optional(v.string()), // Deprecated
  sourcePath: v.optional(v.string()),
  githubRunId: v.optional(v.number()),
  githubRunIdHistory: v.optional(v.array(v.number())),
}

export const pluginFields = {
  slug: v.string(),
  flashCount: v.number(),
  updatedAt: v.number(),
}

export const userSettingsFields = {
  userId: v.id("users"),
  isAdmin: v.boolean(),
}

export const schema = defineSchema({
  ...authTables,
  profiles: defineTable(profileFields).index("by_userId", ["userId"]).index("by_isPublic", ["isPublic"]),
  builds: defineTable(buildFields).index("by_buildHash", ["buildHash"]).index("by_status", ["status"]),
  plugins: defineTable(pluginFields).index("by_slug", ["slug"]),
  userSettings: defineTable(userSettingsFields).index("by_user", ["userId"]),
})

export const buildsDocValidator = schema.tables.builds.validator
export const profilesDocValidator = schema.tables.profiles.validator

export default schema
