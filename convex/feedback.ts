import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

export const create = internalMutation({
  args: {
    name: v.string(),
    email: v.optional(v.string()),
    type: v.string(),
    message: v.string(),
    certificateId: v.optional(v.string()),
  },
  handler: async (ctx, args) => ctx.db.insert("feedback", args),
});

export const listAll = internalQuery({
  args: {},
  handler: async (ctx) => ctx.db.query("feedback").order("desc").collect(),
});

export const remove = internalMutation({
  args: { id: v.id("feedback") },
  handler: async (ctx, { id }) => ctx.db.delete(id),
});
