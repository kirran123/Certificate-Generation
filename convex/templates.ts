import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

export const findById = internalQuery({
  args: { id: v.id("templates") },
  handler: async (ctx, { id }) => ctx.db.get(id),
});

export const create = internalMutation({
  args: {
    name: v.string(),
    imageUrl: v.string(),
    imageStorageId: v.optional(v.id("_storage")),
    imageBase64: v.optional(v.string()),
    layoutConfig: v.any(),
    qrCode: v.optional(v.any()),
    showId: v.optional(v.boolean()),
    showQr: v.optional(v.boolean()),
    createdBy: v.id("users"),
  },
  handler: async (ctx, args) => ctx.db.insert("templates", args),
});

export const update = internalMutation({
  args: {
    id: v.id("templates"),
    name: v.string(),
    imageUrl: v.string(),
    imageStorageId: v.optional(v.id("_storage")),
    imageBase64: v.optional(v.string()),
    layoutConfig: v.any(),
    qrCode: v.optional(v.any()),
    showId: v.optional(v.boolean()),
    showQr: v.optional(v.boolean()),
  },
  handler: async (ctx, { id, ...fields }) => {
    await ctx.db.patch(id, fields);
    return ctx.db.get(id);
  },
});

export const getUrl = internalQuery({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }) => ctx.storage.getUrl(storageId),
});
