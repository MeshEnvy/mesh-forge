import { v } from "convex/values";
import { action } from "./_generated/server";

export const dispatchGithubBuild = action({
	args: {
		target: v.string(),
		flags: v.string(),
	},
	handler: async (_ctx, args) => {
		const githubToken = process.env.GITHUB_TOKEN;
		if (!githubToken) {
			throw new Error("GITHUB_TOKEN is not defined");
		}

		const response = await fetch(
			"https://api.github.com/repos/meshtastic/firmware/actions/workflows/custom_build.yml/dispatches",
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${githubToken}`,
					Accept: "application/vnd.github.v3+json",
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					ref: "master", // or make this configurable
					inputs: {
						target: args.target,
						flags: args.flags,
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
	},
});
