import { internalMutation, mutation } from "./_generated/server";
import { v } from "convex/values";

export const splitBatch = internalMutation({
  args: { cursor: v.optional(v.string()), limit: v.number() },
  handler: async (ctx, { cursor, limit }) => {
    const page = await ctx.db.query("templates").paginate({
      numItems: limit,
      cursor: cursor || null,
    });
    let updated = 0;
    for (const t of page.page) {
      const imageBase64 = (t as any).imageBase64;
      if (imageBase64) {
        const existing = await ctx.db
          .query("templateImages")
          .withIndex("by_templateId", (q) => q.eq("templateId", t._id))
          .first();
        if (!existing) {
          await ctx.db.insert("templateImages", {
            templateId: t._id,
            imageBase64,
          });
        }
        await ctx.db.patch(t._id, { imageBase64: undefined });
        updated++;
      }
    }
    return {
      continueCursor: page.continueCursor,
      isDone: page.isDone,
      updated,
    };
  },
});

export const clearTable = mutation({
  args: { tableName: v.string() },
  handler: async (ctx, { tableName }) => {
    const docs = await ctx.db.query(tableName as any).collect();
    for (const doc of docs) {
      await ctx.db.delete(doc._id);
    }
    return docs.length;
  },
});

export const insertUsers = mutation({
  args: {
    users: v.array(
      v.object({
        oldId: v.string(),
        name: v.string(),
        email: v.string(),
        passwordHash: v.string(),
        role: v.union(v.literal("admin"), v.literal("user")),
      })
    ),
  },
  handler: async (ctx, { users }) => {
    const mapping: Record<string, string> = {};
    for (const u of users) {
      const id = await ctx.db.insert("users", {
        name: u.name,
        email: u.email.toLowerCase(),
        passwordHash: u.passwordHash,
        role: u.role,
      });
      mapping[u.oldId] = id;
    }
    return mapping;
  },
});

export const insertTemplates = mutation({
  args: {
    templates: v.array(
      v.object({
        oldId: v.string(),
        name: v.string(),
        imageUrl: v.optional(v.string()),
        imageBase64: v.optional(v.string()),
        layoutConfig: v.any(),
        qrCode: v.optional(v.any()),
        showId: v.optional(v.boolean()),
        showQr: v.optional(v.boolean()),
        createdBy: v.string(),
      })
    ),
  },
  handler: async (ctx, { templates }) => {
    const mapping: Record<string, string> = {};
    for (const t of templates) {
      const id = await ctx.db.insert("templates", {
        name: t.name,
        imageUrl: t.imageUrl ?? "",
        imageBase64: t.imageBase64,
        layoutConfig: t.layoutConfig,
        qrCode: t.qrCode,
        showId: t.showId,
        showQr: t.showQr,
        createdBy: t.createdBy as any,
      });
      mapping[t.oldId] = id;
    }
    return mapping;
  },
});

export const insertCertificates = mutation({
  args: {
    certificates: v.array(
      v.object({
        certificateId: v.string(),
        name: v.string(),
        email: v.optional(v.string()),
        course: v.optional(v.string()),
        templateId: v.string(),
        pdfUrl: v.optional(v.string()),
        status: v.union(v.literal("Pending"), v.literal("Sent"), v.literal("Failed")),
        createdBy: v.string(),
        batchId: v.optional(v.string()),
        isAutomation: v.optional(v.boolean()),
        isArchived: v.optional(v.boolean()),
        uniqueHash: v.optional(v.string()),
        metadata: v.optional(v.any()),
      })
    ),
  },
  handler: async (ctx, { certificates }) => {
    for (const c of certificates) {
      await ctx.db.insert("certificates", {
        certificateId: c.certificateId,
        name: c.name,
        email: c.email ? c.email.toLowerCase() : undefined,
        course: c.course,
        templateId: c.templateId as any,
        pdfUrl: c.pdfUrl,
        status: c.status,
        createdBy: c.createdBy as any,
        batchId: c.batchId,
        isAutomation: c.isAutomation,
        isArchived: c.isArchived,
        uniqueHash: c.uniqueHash,
        metadata: c.metadata,
      });
    }
    return certificates.length;
  },
});

export const insertAutomations = mutation({
  args: {
    automations: v.array(
      v.object({
        userId: v.string(),
        templateId: v.string(),
        sheetUrl: v.string(),
        sheetId: v.string(),
        gid: v.string(),
        nameColumn: v.string(),
        emailColumn: v.string(),
        batchId: v.string(),
        active: v.boolean(),
        lastChecked: v.optional(v.number()),
        certCount: v.number(),
        emailSubject: v.string(),
        emailMessage: v.string(),
      })
    ),
  },
  handler: async (ctx, { automations }) => {
    for (const a of automations) {
      await ctx.db.insert("formAutomations", {
        userId: a.userId as any,
        templateId: a.templateId as any,
        sheetUrl: a.sheetUrl,
        sheetId: a.sheetId,
        gid: a.gid,
        nameColumn: a.nameColumn,
        emailColumn: a.emailColumn,
        batchId: a.batchId,
        active: a.active,
        lastChecked: a.lastChecked,
        certCount: a.certCount,
        emailSubject: a.emailSubject,
        emailMessage: a.emailMessage,
      });
    }
    return automations.length;
  },
});

export const insertFeedback = mutation({
  args: {
    feedback: v.array(
      v.object({
        name: v.string(),
        email: v.optional(v.string()),
        type: v.string(),
        message: v.string(),
        certificateId: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, { feedback }) => {
    for (const f of feedback) {
      await ctx.db.insert("feedback", {
        name: f.name,
        email: f.email,
        type: f.type,
        message: f.message,
        certificateId: f.certificateId,
      });
    }
    return feedback.length;
  },
});

export const insertEmailLogs = mutation({
  args: {
    logs: v.array(
      v.object({
        certificateId: v.string(),
        recipient: v.string(),
        status: v.union(v.literal("Sent"), v.literal("Failed")),
        error: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, { logs }) => {
    for (const l of logs) {
      await ctx.db.insert("emailLogs", {
        certificateId: l.certificateId,
        recipient: l.recipient,
        status: l.status,
        error: l.error,
      });
    }
    return logs.length;
  },
});
