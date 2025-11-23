import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { auth } from "./auth";

const http = httpRouter();

auth.addHttpRoutes(http);

http.route({
  path: "/github-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const payload = await request.json();
    
    // Verify signature (TODO: Add HMAC verification)
    
    // Handle build completion from our custom workflow
    if (payload.action === "completed" && payload.build_id) {
      const status = payload.status === "success" ? "success" : "failure";
      
      await ctx.runMutation(internal.builds.updateBuildStatus, {
        buildId: payload.build_id,
        status,
      });
      
      return new Response(null, { status: 200 });
    }
    
    // Legacy handling for GitHub webhook events
    if (payload.action === "completed" && payload.workflow_job) {
      const runId = payload.workflow_job.run_id;
      const status = payload.workflow_job.conclusion;
      
      // TODO: Update build status in database
      // Need to match by profile/target since we don't have runId stored yet
      console.log("Build completed:", runId, status);
    }

    return new Response(null, { status: 200 });
  }),
});

http.route({
  path: "/api/logs",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const { buildId, logs } = await request.json();

    if (!buildId || !logs) {
      return new Response("Missing buildId or logs", { status: 400 });
    }

    // TODO: Add some verification (e.g. secret token)

    await ctx.runMutation(internal.builds.appendLogs, {
      buildId,
      logs,
    });

    return new Response(null, { status: 200 });
  }),
});

export default http;
