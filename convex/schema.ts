import { authTables } from '@convex-dev/auth/server'
import { defineSchema, defineTable } from 'convex/server'
import { type Infer, v } from 'convex/values'
import type { Doc } from './_generated/dataModel'

export const profileFields = {
  userId: v.id('users'),
  name: v.string(),
  description: v.string(),
  version: v.string(),
  config: v.object({
    modulesExcluded: v.record(v.string(), v.boolean()),
  }),
  isPublic: v.boolean(),
  flashCount: v.number(),
  updatedAt: v.number(),
}

export const buildFields = {
  buildHash: v.string(),
  target: v.string(),
  version: v.string(),
  status: v.string(),
  startedAt: v.number(),
  updatedAt: v.number(),
  profileString: v.string(),

  // Optional props
  completedAt: v.optional(v.number()),
  artifactPath: v.optional(v.string()),
  githubRunId: v.optional(v.number()),
}

export const schema = defineSchema({
  ...authTables,
  profiles: defineTable(profileFields),
  builds: defineTable(buildFields),
})

export type ProfilesDoc = Doc<'profiles'>
export type BuildsDoc = Doc<'builds'>
export type ProfileFields = Infer<typeof schema.tables.profiles.validator>
export type BuildFields = Infer<typeof schema.tables.builds.validator>

export default schema
