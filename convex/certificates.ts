import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";

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

export const checkHashesExist = internalQuery({
  args: { hashes: v.array(v.string()) },
  handler: async (ctx, { hashes }) => {
    const existing = [];
    for (const hash of hashes) {
      const found = await ctx.db
        .query("certificates")
        .withIndex("by_uniqueHash", (q) => q.eq("uniqueHash", hash))
        .first();
      if (found) {
        existing.push(hash);
      }
    }
    return existing;
  },
});

export const checkCertIdsExist = internalQuery({
  args: { certIds: v.array(v.string()) },
  handler: async (ctx, { certIds }) => {
    const existing = [];
    for (const certId of certIds) {
      const found = await ctx.db
        .query("certificates")
        .withIndex("by_certificateId", (q) => q.eq("certificateId", certId))
        .unique();
      if (found) {
        existing.push(certId);
      }
    }
    return existing;
  },
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

    const templateCache = new Map<string, Promise<any>>();
    const creatorCache = new Map<string, Promise<any>>();

    return Promise.all(
      certs.map(async (c) => {
        let templatePromise = null;
        if (c.templateId) {
          const tIdStr = c.templateId.toString();
          if (!templateCache.has(tIdStr)) {
            templateCache.set(tIdStr, ctx.db.get(c.templateId));
          }
          templatePromise = templateCache.get(tIdStr);
        }

        let creatorPromise = null;
        if (c.createdBy) {
          const uIdStr = c.createdBy.toString();
          if (!creatorCache.has(uIdStr)) {
            creatorCache.set(uIdStr, ctx.db.get(c.createdBy));
          }
          creatorPromise = creatorCache.get(uIdStr);
        }

        const [templateDoc, creator] = await Promise.all([
          templatePromise || Promise.resolve(null),
          creatorPromise || Promise.resolve(null),
        ]);

        const template = templateDoc
          ? {
              _id: templateDoc._id,
              _creationTime: templateDoc._creationTime,
              name: templateDoc.name,
              imageUrl: templateDoc.imageUrl,
              imageStorageId: templateDoc.imageStorageId,
            }
          : null;

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
      .withIndex("by_isArchived", (q) => q.eq("isArchived", false))
      .collect();
    // Sort descending by creation time
    certs.sort((a, b) => b._creationTime - a._creationTime);

    const templateCache = new Map<string, Promise<any>>();
    const creatorCache = new Map<string, Promise<any>>();

    return Promise.all(
      certs.map(async (c) => {
        let templatePromise = null;
        if (c.templateId) {
          const tIdStr = c.templateId.toString();
          if (!templateCache.has(tIdStr)) {
            templateCache.set(tIdStr, ctx.db.get(c.templateId));
          }
          templatePromise = templateCache.get(tIdStr);
        }

        let creatorPromise = null;
        if (c.createdBy) {
          const uIdStr = c.createdBy.toString();
          if (!creatorCache.has(uIdStr)) {
            creatorCache.set(uIdStr, ctx.db.get(c.createdBy));
          }
          creatorPromise = creatorCache.get(uIdStr);
        }

        const [templateDoc, creator] = await Promise.all([
          templatePromise || Promise.resolve(null),
          creatorPromise || Promise.resolve(null),
        ]);

        const template = templateDoc
          ? {
              _id: templateDoc._id,
              _creationTime: templateDoc._creationTime,
              name: templateDoc.name,
              imageUrl: templateDoc.imageUrl,
              imageStorageId: templateDoc.imageStorageId,
            }
          : null;

        return { ...c, templateId: template, createdBy: creator };
      })
    );
  },
});

export const listMyCertificates = internalQuery({
  args: { userId: v.id("users"), email: v.string() },
  handler: async (ctx, { userId, email }) => {
    const certsCreatedBy = await ctx.db
      .query("certificates")
      .withIndex("by_createdBy", (q) => q.eq("createdBy", userId))
      .filter((q) => q.neq(q.field("isArchived"), true))
      .collect();

    const emailLower = email.toLowerCase();
    const certsEmail = await ctx.db
      .query("certificates")
      .withIndex("by_email", (q) => q.eq("email", emailLower))
      .filter((q) => q.neq(q.field("isArchived"), true))
      .collect();

    const mergedMap = new Map<string, Doc<"certificates">>();
    for (const c of certsCreatedBy) {
      mergedMap.set(c._id, c);
    }
    for (const c of certsEmail) {
      mergedMap.set(c._id, c);
    }
    const filtered = Array.from(mergedMap.values());
    filtered.sort((a, b) => b._creationTime - a._creationTime);

    const templateCache = new Map<string, Promise<any>>();
    const creatorCache = new Map<string, Promise<any>>();

    return Promise.all(
      filtered.map(async (c) => {
        let templatePromise = null;
        if (c.templateId) {
          const tIdStr = c.templateId.toString();
          if (!templateCache.has(tIdStr)) {
            templateCache.set(tIdStr, ctx.db.get(c.templateId));
          }
          templatePromise = templateCache.get(tIdStr);
        }

        let creatorPromise = null;
        if (c.createdBy) {
          const uIdStr = c.createdBy.toString();
          if (!creatorCache.has(uIdStr)) {
            creatorCache.set(uIdStr, ctx.db.get(c.createdBy));
          }
          creatorPromise = creatorCache.get(uIdStr);
        }

        const [templateDoc, creator] = await Promise.all([
          templatePromise || Promise.resolve(null),
          creatorPromise || Promise.resolve(null),
        ]);

        const template = templateDoc
          ? {
              _id: templateDoc._id,
              _creationTime: templateDoc._creationTime,
              name: templateDoc.name,
              imageUrl: templateDoc.imageUrl,
              imageStorageId: templateDoc.imageStorageId,
            }
          : null;

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
    isArchived: v.optional(v.boolean()),
    uniqueHash: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => ctx.db.insert("certificates", {
    ...args,
    isArchived: args.isArchived ?? false,
  }),
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
    const certs = await ctx.db
      .query("certificates")
      .withIndex("by_batchId", (q) =>
        q.gte("batchId", batchIdPrefix).lte("batchId", batchIdPrefix + "\uffff")
      )
      .collect();
    return certs.filter((c) => c.status === "Sent").length;
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

export const getStats = internalQuery({
  args: {},
  handler: async (ctx) => {
    const certs = await ctx.db
      .query("certificates")
      .withIndex("by_isArchived", (q) => q.eq("isArchived", false))
      .collect();

    let sent = 0;
    let failed = 0;
    let pending = 0;
    for (const c of certs) {
      if (c.status === "Sent") sent++;
      else if (c.status === "Failed") failed++;
      else if (c.status === "Pending") pending++;
    }

    const users = await ctx.db.query("users").collect();

    return {
      usersCount: users.length,
      certificatesCount: certs.length,
      sentCount: sent,
      failedCount: failed,
      pendingCount: pending,
    };
  },
});

export const countUserStats = internalQuery({
  args: { userId: v.id("users"), email: v.string() },
  handler: async (ctx, { userId, email }) => {
    const emailLower = email.toLowerCase();
    const receivedCerts = await ctx.db
      .query("certificates")
      .withIndex("by_email", (q) => q.eq("email", emailLower))
      .filter((q) => q.neq(q.field("isArchived"), true))
      .collect();

    const generatedCerts = await ctx.db
      .query("certificates")
      .withIndex("by_createdBy", (q) => q.eq("createdBy", userId))
      .filter((q) => q.neq(q.field("isArchived"), true))
      .collect();

    let sent = 0;
    let failed = 0;
    let pending = 0;
    const uniqueBatches = new Set<string>();

    for (const c of generatedCerts) {
      if (c.status === "Sent") sent++;
      else if (c.status === "Failed") failed++;
      else if (c.status === "Pending") pending++;

      const bid = c.batchId || (c.createdAt || c._creationTime ? `Generated ${new Date(c.createdAt || c._creationTime).toLocaleDateString()}` : "Individual");
      uniqueBatches.add(bid);
    }

    return {
      receivedCount: receivedCerts.length,
      batchesCount: uniqueBatches.size,
      sentCount: sent,
      failedCount: failed,
      pendingCount: pending,
    };
  },
});
