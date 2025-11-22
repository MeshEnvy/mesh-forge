import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const list = query({
	args: {},
	handler: async (ctx) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) return [];

		return await ctx.db
			.query("profiles")
			.withIndex("by_user", (q) => q.eq("userId", userId))
			.collect();
	},
});

export const create = mutation({
	args: {
		name: v.string(),
		targets: v.array(v.string()),
		config: v.any(),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new Error("Unauthorized");

		return await ctx.db.insert("profiles", {
			userId,
			name: args.name,
			targets: args.targets,
			config: args.config,
			updatedAt: Date.now(),
		});
	},
});

export const update = mutation({
	args: {
		id: v.id("profiles"),
		name: v.string(),
		targets: v.array(v.string()),
		config: v.any(),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new Error("Unauthorized");

		const profile = await ctx.db.get(args.id);
		if (!profile || profile.userId !== userId) {
			throw new Error("Unauthorized");
		}

		await ctx.db.patch(args.id, {
			name: args.name,
			targets: args.targets,
			config: args.config,
			updatedAt: Date.now(),
		});
	},
});

export const remove = mutation({
	args: { id: v.id("profiles") },
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new Error("Unauthorized");

		const profile = await ctx.db.get(args.id);
		if (!profile || profile.userId !== userId) {
			throw new Error("Unauthorized");
		}

		await ctx.db.delete(args.id);
	},
});
