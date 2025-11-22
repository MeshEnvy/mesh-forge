import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { auth } from "./auth";

const http = httpRouter();

auth.addHttpRoutes(http);

http.route({
  path: "/github-webhook",
  method: "POST",
  handler: httpAction(async (_ctx, request) => {
    const payload = await request.json();
    
    // Verify signature (TODO: Add HMAC verification)
    
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

export default http;
