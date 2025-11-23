import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";

export const dispatchGithubBuild = action({
	args: {
		buildId: v.id("builds"),
		target: v.string(),
		flags: v.string(),
		version: v.string(),
	},
	handler: async (ctx, args) => {
		const githubToken = process.env.GITHUB_TOKEN;
		if (!githubToken) {
			throw new Error("GITHUB_TOKEN is not set");
		}

		try {
			const response = await fetch(
				"https://api.github.com/repos/MeshEnvy/configurable-web-flasher/actions/workflows/custom_build.yml/dispatches",
				{
					method: "POST",
					headers: {
						Authorization: `Bearer ${githubToken}`,
						Accept: "application/vnd.github.v3+json",
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						ref: "main", // or make this configurable
						inputs: {
							target: args.target,
							flags: args.flags,
							version: args.version,
							build_id: args.buildId,
							convex_url: process.env.CONVEX_SITE_URL,
						},
					}),
				},
			);

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`GitHub API failed: ${response.status} ${errorText}`);
			}

			// Note: GitHub dispatch API doesn't return the run ID immediately.
			// We rely on the webhook to link the run back to our build record.
			// Alternatively, we could poll for the most recent run, but that's race-condition prone.
		} catch (error) {
			await ctx.runMutation(internal.builds.logBuildError, {
				buildId: args.buildId,
				error: String(error),
			});
			// Re-throw so it shows up in Convex logs too
			throw error;
		}
	},
});
