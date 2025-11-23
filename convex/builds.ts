import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { internalMutation, mutation, query } from "./_generated/server";
import modulesData from "./modules.json";

/**
 * Normalizes a config object to a stable JSON string for hashing.
 * Sorts keys and handles values consistently.
 */
function normalizeConfig(config: any): string {
	const normalized: Record<string, any> = {};
	
	// Sort keys and process values
	const sortedKeys = Object.keys(config || {}).sort();
	
	for (const key of sortedKeys) {
		const value = config[key];
		// Only include non-null, non-undefined values
		if (value !== null && value !== undefined) {
			// Normalize boolean, number, and string values
			if (typeof value === "boolean") {
				normalized[key] = value;
			} else if (typeof value === "number") {
				normalized[key] = value;
			} else if (typeof value === "string") {
				// Only include non-empty strings
				if (value.trim() !== "") {
					normalized[key] = value.trim();
				}
			}
		}
	}
	
	return JSON.stringify(normalized);
}

/**
 * Computes a stable SHA-256 hash from version, target, and config.
 * This hash uniquely identifies a build configuration.
 */
async function computeBuildHash(
	version: string,
	target: string,
	config: any,
): Promise<string> {
	const normalizedConfig = normalizeConfig(config);
	const input = JSON.stringify({
		version,
		target,
		config: normalizedConfig,
	});
	
	// Use Web Crypto API for SHA-256 hashing
	const encoder = new TextEncoder();
	const data = encoder.encode(input);
	const hashBuffer = await crypto.subtle.digest("SHA-256", data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
	
	return hashHex;
}

/**
 * Constructs the R2 artifact URL from a build hash.
 * Uses the R2 public URL pattern: https://<bucket>.<account-id>.r2.cloudflarestorage.com/<hash>.uf2
 * Or custom domain if R2_PUBLIC_URL is set.
 */
function getR2ArtifactUrl(buildHash: string): string {
	const r2PublicUrl = process.env.R2_PUBLIC_URL;
	if (r2PublicUrl) {
		// Custom domain configured
		return `${r2PublicUrl}/${buildHash}.uf2`;
	}
	// Default R2 public URL pattern (requires public bucket)
	const bucketName = process.env.R2_BUCKET_NAME || "firmware-builds";
	const accountId = process.env.R2_ACCOUNT_ID || "";
	if (accountId) {
		return `https://${bucketName}.${accountId}.r2.cloudflarestorage.com/${buildHash}.uf2`;
	}
	// Fallback: assume custom domain or public bucket URL
	return `https://${bucketName}.r2.cloudflarestorage.com/${buildHash}.uf2`;
}

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
		const flags: string[] = [];

		// Handle Modules (Inverted Logic: Default Excluded)
		for (const module of modulesData.modules) {
			// If config[id] is NOT false (explicitly included), we exclude it.
			if (profile.config[module.id] !== false) {
				flags.push(`-D${module.id}=1`);
			}
		}
		
		const flagsString = flags.join(" ");

		// Create build records for each target
		for (const target of profile.targets) {
			// Compute build hash
			const buildHash = await computeBuildHash(
				profile.version,
				target,
				profile.config,
			);

			// Check cache for existing build
			const cached = await ctx.db
				.query("buildCache")
				.withIndex("by_hash_target", (q) =>
					q.eq("buildHash", buildHash).eq("target", target),
				)
				.first();

			if (cached) {
				// Use cached artifact, skip GitHub workflow
				const artifactUrl = getR2ArtifactUrl(buildHash);
				const _buildId = await ctx.db.insert("builds", {
					profileId: profile._id,
					target: target,
					githubRunId: 0,
					status: "success",
					artifactUrl: artifactUrl,
					logs: "Build completed from cache",
					startedAt: Date.now(),
					completedAt: Date.now(),
					buildHash: buildHash,
				});
			} else {
				// Not cached, proceed with normal build flow
				const buildId = await ctx.db.insert("builds", {
					profileId: profile._id,
					target: target,
					githubRunId: 0,
					status: "queued",
					logs: "Build queued...",
					startedAt: Date.now(),
					buildHash: buildHash,
				});

				// Schedule the action to dispatch GitHub workflow
				await ctx.scheduler.runAfter(0, api.actions.dispatchGithubBuild, {
					buildId: buildId,
					target: target,
					flags: flagsString,
					version: profile.version,
					buildHash: buildHash,
				});
			}
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

// Internal query to get build without auth checks (for webhooks)
export const getInternal = internalMutation({
	args: { buildId: v.id("builds") },
	handler: async (ctx, args) => {
		return await ctx.db.get(args.buildId);
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

		// Convert config object to flags string
		const flags: string[] = [];

		// Handle Modules (Inverted Logic: Default Excluded)
		for (const module of modulesData.modules) {
			// If config[id] is NOT false (explicitly included), we exclude it.
			if (profile.config[module.id] !== false) {
				flags.push(`-D${module.id}=1`);
			}
		}
		
		const flagsString = flags.join(" ");

		// Compute build hash for retry
		const buildHash = await computeBuildHash(
			profile.version,
			build.target,
			profile.config,
		);

		await ctx.scheduler.runAfter(0, api.actions.dispatchGithubBuild, {
			buildId: args.buildId,
			target: build.target,
			flags: flagsString,
			version: profile.version,
			buildHash: buildHash,
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
		artifactUrl: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const build = await ctx.db.get(args.buildId);
		if (!build) return;

		const updateData: any = {
			status: args.status,
			completedAt: Date.now(),
		};

		if (args.artifactUrl) {
			updateData.artifactUrl = args.artifactUrl;
		}

		await ctx.db.patch(args.buildId, updateData);

		// If build succeeded and we have buildHash, store in cache with R2 URL
		if (args.status === "success" && build.buildHash && build.target) {
			// Get version from profile
			const profile = await ctx.db.get(build.profileId);
			if (profile) {
				// Construct R2 URL from hash
				const artifactUrl = getR2ArtifactUrl(build.buildHash);
				
				// Update build with R2 URL if not already set
				if (!args.artifactUrl) {
					updateData.artifactUrl = artifactUrl;
					await ctx.db.patch(args.buildId, { artifactUrl });
				}

				// Check if cache entry already exists
				const existing = await ctx.db
					.query("buildCache")
					.withIndex("by_hash_target", (q) =>
						q.eq("buildHash", build.buildHash!).eq("target", build.target),
					)
					.first();

				if (!existing) {
					// Store in cache
					await ctx.db.insert("buildCache", {
						buildHash: build.buildHash,
						target: build.target,
						artifactUrl: artifactUrl,
						version: profile.version,
						createdAt: Date.now(),
					});
				}
			}
		}
	},
});
