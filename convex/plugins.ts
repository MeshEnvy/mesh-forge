import { v } from "convex/values"
import { internalMutation, query } from "./_generated/server"

export const get = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const plugin = await ctx.db
      .query("plugins")
      .withIndex("by_slug", q => q.eq("slug", args.slug))
      .unique()
    return plugin ? { slug: plugin.slug, flashCount: plugin.flashCount } : { slug: args.slug, flashCount: 0 }
  },
})

export const getAll = query({
  args: {},
  handler: async ctx => {
    const plugins = await ctx.db.query("plugins").collect()
    const counts: Record<string, number> = {}
    for (const plugin of plugins) {
      counts[plugin.slug] = plugin.flashCount
    }
    return counts
  },
})

export const incrementFlashCount = internalMutation({
  args: { slugs: v.array(v.string()) },
  handler: async (ctx, args) => {
    for (const pluginSpec of args.slugs) {
      // Extract slug from "slug@version" format, or use as-is if no @ present
      const slug = pluginSpec.split("@")[0]

      const existing = await ctx.db
        .query("plugins")
        .withIndex("by_slug", q => q.eq("slug", slug))
        .unique()

      if (existing) {
        await ctx.db.patch(existing._id, {
          flashCount: existing.flashCount + 1,
          updatedAt: Date.now(),
        })
      } else {
        await ctx.db.insert("plugins", {
          slug,
          flashCount: 1,
          updatedAt: Date.now(),
        })
      }
    }
  },
})
