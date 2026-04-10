import { v } from "convex/values"
import { internal } from "./_generated/api"
import type { Doc } from "./_generated/dataModel"
import { action } from "./_generated/server"

export const getSignedDownloadUrl = action({
  args: { buildId: v.id("repoBuilds") },
  handler: async (ctx, args): Promise<string> => {
    const doc = (await ctx.runQuery(internal.repoBuilds.getByIdInternal, {
      id: args.buildId,
    })) as Doc<"repoBuilds"> | null
    if (!doc || doc.status !== "succeeded" || !doc.r2ObjectKey) {
      throw new Error("Build not ready or missing artifact")
    }
    const { generateSignedDownloadUrl } = await import("./lib/r2")
    const filename = `firmware-${doc.buildKey}.tar.gz`
    return await generateSignedDownloadUrl(doc.r2ObjectKey, filename, "application/gzip")
  },
})
