import { authTables } from '@convex-dev/auth/server'
import { defineSchema, defineTable } from 'convex/server'
import { type Infer, v } from 'convex/values'
import type { Doc } from './_generated/dataModel'

export const buildConfigFields = {
  version: v.string(),
  modulesExcluded: v.record(v.string(), v.boolean()),
  target: v.string(),
  pluginsEnabled: v.optional(v.array(v.string())),
}

export const profileFields = {
  userId: v.id('users'),
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
  artifactPath: v.optional(v.string()),
  githubRunId: v.optional(v.number()),
}

export const pluginFields = {
  slug: v.string(),
  flashCount: v.number(),
  updatedAt: v.number(),
}

export const schema = defineSchema({
  ...authTables,
  profiles: defineTable(profileFields),
  builds: defineTable(buildFields),
  plugins: defineTable(pluginFields).index('by_slug', ['slug']),
})

export type ProfilesDoc = Doc<'profiles'>
export type BuildsDoc = Doc<'builds'>
export const buildsDocValidator = schema.tables.builds.validator
export const profilesDocValidator = schema.tables.profiles.validator
export type ProfileFields = Infer<typeof profilesDocValidator>
export type BuildFields = Infer<typeof buildsDocValidator>

const buildConfigFieldsValidator = v.object(buildConfigFields)
export type BuildConfigFields = Infer<typeof buildConfigFieldsValidator>

export default schema
