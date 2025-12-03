import { httpRouter } from 'convex/server'
import { internal } from './_generated/api'
import { httpAction } from './_generated/server'
import { auth } from './auth'

const http = httpRouter()

auth.addHttpRoutes(http)

http.route({
  path: '/github-webhook',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    // Verify bearer token
    const buildToken = process.env.CONVEX_BUILD_TOKEN
    if (!buildToken) {
      return new Response('CONVEX_BUILD_TOKEN not configured', { status: 500 })
    }

    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response('Missing or invalid Authorization header', {
        status: 401,
      })
    }

    const token = authHeader.substring(7) // Remove 'Bearer ' prefix
    if (token !== buildToken) {
      return new Response('Invalid token', { status: 401 })
    }

    const payload = await request.json()

    // Validate build_id and state are present
    if (!payload.build_id || !payload.state) {
      return new Response('Missing build_id or state', { status: 400 })
    }

    // Verify build exists
    const build = await ctx.runMutation(internal.builds.getInternal, {
      buildId: payload.build_id,
    })

    if (!build) {
      return new Response('Build not found', { status: 404 })
    }

    const githubRunId = payload.github_run_id
      ? Number(payload.github_run_id)
      : undefined

    await ctx.runMutation(internal.builds.updateBuildStatus, {
      buildId: payload.build_id,
      status: payload.state,
      githubRunId,
      firmwarePath: payload.firmwarePath ?? payload.artifactPath,
      sourcePath: payload.sourcePath,
    })

    return new Response(null, { status: 200 })
  }),
})

export default http
