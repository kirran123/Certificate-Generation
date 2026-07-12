import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

export const findByEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    return ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
  },
});

export const findById = internalQuery({
  args: { id: v.id("users") },
  handler: async (ctx, { id }) => ctx.db.get(id),
});

export const create = internalMutation({
  args: {
    name: v.string(),
    email: v.string(),
    passwordHash: v.string(),
    role: v.union(v.literal("admin"), v.literal("user")),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("users", args);
  },
});

export const updatePassword = internalMutation({
  args: { id: v.id("users"), passwordHash: v.string() },
  handler: async (ctx, { id, passwordHash }) => {
    await ctx.db.patch(id, { passwordHash });
  },
});

export const setRole = internalMutation({
  args: { id: v.id("users"), role: v.union(v.literal("admin"), v.literal("user")) },
  handler: async (ctx, { id, role }) => {
    await ctx.db.patch(id, { role });
  },
});

export const listAll = internalQuery({
  args: {},
  handler: async (ctx) => ctx.db.query("users").collect(),
});

export const remove = internalMutation({
  args: { id: v.id("users") },
  handler: async (ctx, { id }) => ctx.db.delete(id),
});
