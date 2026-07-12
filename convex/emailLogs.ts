import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

export const create = internalMutation({
  args: {
    certificateId: v.string(),
    recipient: v.string(),
    status: v.union(v.literal("Sent"), v.literal("Failed")),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => ctx.db.insert("emailLogs", args),
});

export const listAll = internalQuery({
  args: {},
  handler: async (ctx) =>
    ctx.db.query("emailLogs").order("desc").collect(),
});
