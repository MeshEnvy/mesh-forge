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
    const workflowRef = isDev ? "develop" : "main"

    const payload = {
      ref: workflowRef,
      inputs: {
        owner: doc.owner,
        repo: doc.repo,
        ref: doc.ref,
        target_env: doc.targetEnv,
        platform_root: doc.platformRoot ?? "",
        repo_build_id: doc._id,
        build_key: doc.buildKey,
        resolved_source_sha: doc.resolvedSourceSha,
        convex_url: convexUrl || "https://example.com",
      },
    }

    const url = `https://api.github.com/repos/MeshEnvy/mesh-forge/actions/workflows/custom_build.yml/dispatches`
    const headers = {
      Authorization: `Bearer ${githubToken}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
    }

    const maxAttempts = 4
    let lastError: unknown
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (attempt > 1) {
        const delayMs = 800 * 2 ** (attempt - 2)
        await new Promise(r => setTimeout(r, delayMs))
      }
      try {
        const response = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
        })
        const errorText = await response.text()
        if (response.ok) {
          return
        }
        const transient =
          response.status === 429 ||
          (response.status >= 500 && response.status < 600)
        if (transient && attempt < maxAttempts) {
          lastError = new Error(`GitHub API failed: ${response.status} ${errorText}`)
          continue
        }
        throw new Error(`GitHub API failed: ${response.status} ${errorText}`)
      } catch (error) {
        lastError = error
        const msg = String(error)
        const network =
          msg.includes("fetch failed") ||
          msg.includes("ECONNRESET") ||
          msg.includes("ETIMEDOUT") ||
          msg.includes("ENOTFOUND") ||
          msg.includes("EAI_AGAIN")
        if (network && attempt < maxAttempts) {
          continue
        }
        await ctx.runMutation(internal.repoBuilds.logBuildDispatchError, {
          buildId: args.buildId,
          message: String(error),
        })
        throw error
      }
    }
    await ctx.runMutation(internal.repoBuilds.logBuildDispatchError, {
      buildId: args.buildId,
      message: String(lastError),
    })
    throw lastError
  },
})
