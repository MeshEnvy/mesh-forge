import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { mutation, query } from "./_generated/server";

export const triggerBuild = mutation({
	args: {
		profileId: v.id("profiles"),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new Error("Unauthorized");

		const profile = await ctx.db.get(args.profileId);
		if (!profile || profile.userId !== userId) {
			throw new Error("Unauthorized");
		}

		// Convert config object to flags string
		// e.g. { "NO_MQTT": true } -> "-DNO_MQTT"
		const flags = Object.entries(profile.config)
			.filter(([_, value]) => value === true)
			.map(([key, _]) => `-D${key}`)
			.join(" ");

		// Create build records for each target
		for (const target of profile.targets) {
			await ctx.db.insert("builds", {
				profileId: profile._id,
				target: target,
				githubRunId: 0, // Placeholder, updated via webhook
				status: "queued",
				startedAt: Date.now(),
			});

			// Schedule the action to dispatch GitHub workflow
			await ctx.scheduler.runAfter(0, api.actions.dispatchGithubBuild, {
				target: target,
				flags: flags,
			});
		}
	},
});

export const listByProfile = query({
	args: { profileId: v.id("profiles") },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("builds")
			.withIndex("by_profile", (q) => q.eq("profileId", args.profileId))
			.order("desc")
			.take(10);
	},
});
