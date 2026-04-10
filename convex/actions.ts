import { v } from "convex/values"
import { internal } from "./_generated/api"
import { action } from "./_generated/server"

export const dispatchRepoBuild = action({
  args: {
    buildId: v.id("repoBuilds"),
  },
  handler: async (ctx, args) => {
    const githubToken = process.env.GITHUB_TOKEN
    if (!githubToken) {
      throw new Error("GITHUB_TOKEN is not set")
    }

    const convexUrl = process.env.CONVEX_SITE_URL
    if (!convexUrl) {
      console.error("CONVEX_SITE_URL is not set")
    }

    const doc = await ctx.runQuery(internal.repoBuilds.getByIdInternal, { id: args.buildId })
    if (!doc) {
      throw new Error("repoBuild not found")
    }

    const isDev = process.env.CONVEX_ENV === "dev"
    const workflowFile = isDev ? "custom_build_test.yml" : "custom_build.yml"

    const payload = {
      ref: "main",
      inputs: {
        owner: doc.owner,
        repo: doc.repo,
        ref: doc.ref,
        target_env: doc.targetEnv,
        repo_build_id: doc._id,
        build_key: doc.buildKey,
        resolved_source_sha: doc.resolvedSourceSha,
        convex_url: convexUrl || "https://example.com",
      },
    }

    try {
      const url = `https://api.github.com/repos/MeshEnvy/mesh-forge/actions/workflows/${workflowFile}/dispatches`
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`GitHub API failed: ${response.status} ${errorText}`)
      }
    } catch (error) {
      await ctx.runMutation(internal.repoBuilds.logBuildDispatchError, {
        buildId: args.buildId,
        message: String(error),
      })
      throw error
    }
  },
})
