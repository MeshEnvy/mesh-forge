import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
	...authTables,
	profiles: defineTable({
		userId: v.id("users"),
		name: v.string(),
		targets: v.array(v.string()), // e.g. ["tbeam", "rak4631"]
		config: v.any(), // JSON object for flags
		updatedAt: v.number(),
	}).index("by_user", ["userId"]),

	builds: defineTable({
		profileId: v.id("profiles"),
		target: v.string(),
		githubRunId: v.number(),
		status: v.string(), // "queued", "in_progress", "success", "failure"
		artifactUrl: v.optional(v.string()),
		startedAt: v.number(),
		completedAt: v.optional(v.number()),
	}).index("by_profile", ["profileId"]),
});
