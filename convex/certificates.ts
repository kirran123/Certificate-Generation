import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

export const findByCertId = internalQuery({
  args: { certificateId: v.string() },
  handler: async (ctx, { certificateId }) =>
    ctx.db.query("certificates").withIndex("by_certificateId", (q) => q.eq("certificateId", certificateId)).unique(),
});

export const findByHash = internalQuery({
  args: { uniqueHash: v.string() },
  handler: async (ctx, { uniqueHash }) =>
    ctx.db.query("certificates").withIndex("by_uniqueHash", (q) => q.eq("uniqueHash", uniqueHash)).first(),
});

export const listForUser = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const certs = await ctx.db
      .query("certificates")
      .withIndex("by_createdBy", (q) => q.eq("createdBy", userId))
      .filter((q) => q.neq(q.field("isArchived"), true))
      .collect();
    // Sort descending by creation time
    certs.sort((a, b) => b._creationTime - a._creationTime);
    return Promise.all(
      certs.map(async (c) => {
        const templateDoc = c.templateId ? await ctx.db.get(c.templateId) : null;
        const template = templateDoc
          ? {
              _id: templateDoc._id,
              _creationTime: templateDoc._creationTime,
              name: templateDoc.name,
              imageUrl: templateDoc.imageUrl,
              imageStorageId: templateDoc.imageStorageId,
            }
          : null;
        const creator = c.createdBy ? await ctx.db.get(c.createdBy) : null;
        return { ...c, templateId: template, createdBy: creator };
      })
    );
  },
});

export const listAll = internalQuery({
  args: {},
  handler: async (ctx) => {
    const certs = await ctx.db
      .query("certificates")
      .filter((q) => q.neq(q.field("isArchived"), true))
      .collect();
    // Sort descending by creation time
    certs.sort((a, b) => b._creationTime - a._creationTime);
    return Promise.all(
      certs.map(async (c) => {
        const templateDoc = c.templateId ? await ctx.db.get(c.templateId) : null;
        const template = templateDoc
          ? {
              _id: templateDoc._id,
              _creationTime: templateDoc._creationTime,
              name: templateDoc.name,
              imageUrl: templateDoc.imageUrl,
              imageStorageId: templateDoc.imageStorageId,
            }
          : null;
        const creator = c.createdBy ? await ctx.db.get(c.createdBy) : null;
        return { ...c, templateId: template, createdBy: creator };
      })
    );
  },
});

export const listMyCertificates = internalQuery({
  args: { userId: v.id("users"), email: v.string() },
  handler: async (ctx, { userId, email }) => {
    const certs = await ctx.db
      .query("certificates")
      .filter((q) => q.neq(q.field("isArchived"), true))
      .collect();

    const emailLower = email.toLowerCase();
    const filtered = certs.filter(
      (c) =>
        c.createdBy === userId ||
        (c.email && c.email.toLowerCase() === emailLower)
    );

    // Sort descending by creation time
    filtered.sort((a, b) => b._creationTime - a._creationTime);

    return Promise.all(
      filtered.map(async (c) => {
        const templateDoc = c.templateId ? await ctx.db.get(c.templateId) : null;
        const template = templateDoc
          ? {
              _id: templateDoc._id,
              _creationTime: templateDoc._creationTime,
              name: templateDoc.name,
              imageUrl: templateDoc.imageUrl,
              imageStorageId: templateDoc.imageStorageId,
            }
          : null;
        const creator = c.createdBy ? await ctx.db.get(c.createdBy) : null;
        return { ...c, templateId: template, createdBy: creator };
      })
    );
  },
});

export const create = internalMutation({
  args: {
    certificateId: v.string(),
    name: v.string(),
    email: v.optional(v.string()),
    course: v.optional(v.string()),
    templateId: v.id("templates"),
    status: v.union(v.literal("Pending"), v.literal("Sent"), v.literal("Failed")),
    createdBy: v.id("users"),
    batchId: v.optional(v.string()),
    isAutomation: v.optional(v.boolean()),
    uniqueHash: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => ctx.db.insert("certificates", args),
});

export const updateStatus = internalMutation({
  args: { id: v.id("certificates"), status: v.union(v.literal("Pending"), v.literal("Sent"), v.literal("Failed")) },
  handler: async (ctx, { id, status }) => ctx.db.patch(id, { status }),
});

export const updateEmail = internalMutation({
  args: { id: v.id("certificates"), email: v.string() },
  handler: async (ctx, { id, email }) => ctx.db.patch(id, { email }),
});

export const archiveBatch = internalMutation({
  args: { batchId: v.string(), userId: v.id("users"), isAdmin: v.boolean() },
  handler: async (ctx, { batchId, userId, isAdmin }) => {
    const all = await ctx.db
      .query("certificates")
      .withIndex("by_batchId", (q) => q.eq("batchId", batchId))
      .collect();
    let count = 0;
    for (const c of all) {
      if (isAdmin || c.createdBy === userId) {
        await ctx.db.patch(c._id, { isArchived: true, pdfUrl: undefined });
        count++;
      }
    }
    return count;
  },
});

export const remove = internalMutation({
  args: { id: v.id("certificates") },
  handler: async (ctx, { id }) => ctx.db.delete(id),
});

export const findConvexId = internalQuery({
  args: { certificateId: v.string() },
  handler: async (ctx, { certificateId }) =>
    ctx.db.query("certificates").withIndex("by_certificateId", (q) => q.eq("certificateId", certificateId)).unique(),
});

export const countByBatchAndStatus = internalQuery({
  args: { batchIdPrefix: v.string() },
  handler: async (ctx, { batchIdPrefix }) => {
    const all = await ctx.db.query("certificates").collect();
    return all.filter(
      (c) => c.batchId?.startsWith(batchIdPrefix) && c.status === "Sent"
    ).length;
  },
});

export const listByIds = internalQuery({
  args: { certificateIds: v.array(v.string()) },
  handler: async (ctx, { certificateIds }) => {
    const results = [];
    for (const certId of certificateIds) {
      const cert = await ctx.db
        .query("certificates")
        .withIndex("by_certificateId", (q) => q.eq("certificateId", certId))
        .unique();
      if (cert) results.push(cert);
    }
    return results;
  },
});

export const listByBatchId = internalQuery({
  args: { batchId: v.string() },
  handler: async (ctx, { batchId }) =>
    ctx.db.query("certificates").withIndex("by_batchId", (q) => q.eq("batchId", batchId)).collect(),
});
