import { httpRouter } from "convex/server"
import type { Id } from "./_generated/dataModel"
import { internal } from "./_generated/api"
import { httpAction } from "./_generated/server"
import { auth } from "./auth"

const http = httpRouter()

auth.addHttpRoutes(http)

function verifyBearer(request: Request): boolean {
  const buildToken = process.env.CONVEX_BUILD_TOKEN
  if (!buildToken) return false
  const authHeader = request.headers.get("Authorization")
  if (!authHeader?.startsWith("Bearer ")) return false
  return authHeader.slice(7) === buildToken
}

function mapWebhookStatus(state: string): "running" | "succeeded" | "failed" {
  const s = state.toLowerCase()
  if (s === "running" || s === "queued") return "running"
  if (s === "succeeded" || s === "success" || s === "completed") return "succeeded"
  if (s === "failed" || s === "failure") return "failed"
  return "running"
}

http.route({
  path: "/ingest-repo-build",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!verifyBearer(request)) {
      return new Response("Unauthorized", { status: 401 })
    }
    const payload = (await request.json()) as {
      repo_build_id?: string
      state?: string
      github_run_id?: string | number
      r2ObjectKey?: string
      errorSummary?: string
    }

    if (!payload.repo_build_id || !payload.state) {
      return new Response("Missing repo_build_id or state", { status: 400 })
    }

    const runId = payload.github_run_id !== undefined ? Number(payload.github_run_id) : undefined
    await ctx.runMutation(internal.repoBuilds.patchFromWebhook, {
      buildId: payload.repo_build_id as Id<"repoBuilds">,
      status: mapWebhookStatus(payload.state),
      githubRunId: Number.isFinite(runId) ? runId : undefined,
      r2ObjectKey: payload.r2ObjectKey,
      errorSummary: payload.errorSummary,
    })

    return new Response(null, { status: 200 })
  }),
})

/** Legacy: old workflows posting build_id + state */
http.route({
  path: "/github-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!verifyBearer(request)) {
      return new Response("Unauthorized", { status: 401 })
    }
    const payload = (await request.json()) as {
      build_id?: string
      repo_build_id?: string
      state?: string
      github_run_id?: string | number
      firmwarePath?: string
      r2ObjectKey?: string
      errorSummary?: string
    }
    const id = payload.repo_build_id || payload.build_id
    if (!id || !payload.state) {
      return new Response("Missing build id or state", { status: 400 })
    }
    const runId = payload.github_run_id !== undefined ? Number(payload.github_run_id) : undefined
    await ctx.runMutation(internal.repoBuilds.patchFromWebhook, {
      buildId: id as Id<"repoBuilds">,
      status: mapWebhookStatus(payload.state),
      githubRunId: Number.isFinite(runId) ? runId : undefined,
      r2ObjectKey: payload.r2ObjectKey || payload.firmwarePath,
      errorSummary: payload.errorSummary,
    })
    return new Response(null, { status: 200 })
  }),
})

export default http
