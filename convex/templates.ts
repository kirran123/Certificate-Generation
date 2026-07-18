import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

export const findById = internalQuery({
  args: { id: v.id("templates") },
  handler: async (ctx, { id }) => {
    const template = await ctx.db.get(id);
    if (!template) return null;
    const img = await ctx.db
      .query("templateImages")
      .withIndex("by_templateId", (q) => q.eq("templateId", id))
      .first();
    return { ...template, imageBase64: img?.imageBase64 };
  },
});

export const findMetadataById = internalQuery({
  args: { id: v.id("templates") },
  handler: async (ctx, { id }) => {
    return ctx.db.get(id);
  },
});

export const getTemplateImage = internalQuery({
  args: { templateId: v.id("templates") },
  handler: async (ctx, { templateId }) => {
    const img = await ctx.db
      .query("templateImages")
      .withIndex("by_templateId", (q) => q.eq("templateId", templateId))
      .first();
    return img?.imageBase64 || null;
  },
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
  handler: async (ctx, args) => {
    const { imageBase64, ...fields } = args;
    const templateId = await ctx.db.insert("templates", fields);
    if (imageBase64) {
      await ctx.db.insert("templateImages", { templateId, imageBase64 });
    }
    return templateId;
  },
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
  handler: async (ctx, { id, imageBase64, ...fields }) => {
    await ctx.db.patch(id, fields);
    if (imageBase64 !== undefined) {
      const existing = await ctx.db
        .query("templateImages")
        .withIndex("by_templateId", (q) => q.eq("templateId", id))
        .first();
      if (existing) {
        if (imageBase64) {
          await ctx.db.patch(existing._id, { imageBase64 });
        } else {
          await ctx.db.delete(existing._id);
        }
      } else if (imageBase64) {
        await ctx.db.insert("templateImages", { templateId: id, imageBase64 });
      }
    }
    const template = await ctx.db.get(id);
    if (!template) return null;
    const img = await ctx.db
      .query("templateImages")
      .withIndex("by_templateId", (q) => q.eq("templateId", id))
      .first();
    return { ...template, imageBase64: img?.imageBase64 };
  },
});

export const getUrl = internalQuery({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }) => ctx.storage.getUrl(storageId),
});
