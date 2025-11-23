import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { api, } from "./_generated/api";
import { internalMutation, mutation, query } from "./_generated/server";

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
		const flags = Object.entries(profile.config)
			.filter(([_, value]) => value === true)
			.map(([key, _]) => `-D${key}`)
			.join(" ");

		// Create build records for each target
		for (const target of profile.targets) {
			const buildId = await ctx.db.insert("builds", {
				profileId: profile._id,
				target: target,
				githubRunId: 0,
				status: "queued",
				logs: "Build queued...",
				startedAt: Date.now(),
			});

			// Schedule the action to dispatch GitHub workflow
			await ctx.scheduler.runAfter(0, api.actions.dispatchGithubBuild, {
				buildId: buildId,
				target: target,
				flags: flags,
				version: profile.version,
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

export const get = query({
	args: { buildId: v.id("builds") },
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) return null;

		const build = await ctx.db.get(args.buildId);
		if (!build) return null;

		const profile = await ctx.db.get(build.profileId);
		if (!profile || profile.userId !== userId) return null;

		return build;
	},
});

export const deleteBuild = mutation({
	args: { buildId: v.id("builds") },
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new Error("Unauthorized");

		const build = await ctx.db.get(args.buildId);
		if (!build) throw new Error("Build not found");

		const profile = await ctx.db.get(build.profileId);
		if (!profile || profile.userId !== userId) {
			throw new Error("Unauthorized");
		}

		await ctx.db.delete(args.buildId);
	},
});

export const retryBuild = mutation({
	args: { buildId: v.id("builds") },
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new Error("Unauthorized");

		const build = await ctx.db.get(args.buildId);
		if (!build) throw new Error("Build not found");

		const profile = await ctx.db.get(build.profileId);
		if (!profile || profile.userId !== userId) {
			throw new Error("Unauthorized");
		}

		// Reset build status
		await ctx.db.patch(args.buildId, {
			status: "queued",
			logs: "Build retry queued...",
			startedAt: Date.now(),
			completedAt: undefined,
		});

		// Retry the build
		const flags = Object.entries(profile.config)
			.filter(([_, value]) => value === true)
			.map(([key, _]) => `-D${key}`)
			.join(" ");

		await ctx.scheduler.runAfter(0, api.actions.dispatchGithubBuild, {
			buildId: args.buildId,
			target: build.target,
			flags: flags,
			version: profile.version,
		});
	},
});

// Internal mutation to log errors from actions
export const logBuildError = internalMutation({
	args: {
		buildId: v.id("builds"),
		error: v.string(),
	},
	handler: async (ctx, args) => {
		await ctx.db.patch(args.buildId, {
			status: "failure",
			logs: `Error triggering build: ${args.error}`,
			completedAt: Date.now(),
		});
	},
});

// Internal mutation to append logs
export const appendLogs = internalMutation({
	args: {
		buildId: v.id("builds"),
		logs: v.string(),
	},
	handler: async (ctx, args) => {
		const build = await ctx.db.get(args.buildId);
		if (!build) return;

		await ctx.db.patch(args.buildId, {
			logs: (build.logs || "") + args.logs,
		});
	},
});

// Internal mutation to update build status
export const updateBuildStatus = internalMutation({
	args: {
		buildId: v.id("builds"),
		status: v.union(v.literal("success"), v.literal("failure")),
	},
	handler: async (ctx, args) => {
		await ctx.db.patch(args.buildId, {
			status: args.status,
			completedAt: Date.now(),
		});
	},
});
