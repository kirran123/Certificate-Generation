import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

export const listActive = internalQuery({
  args: {},
  handler: async (ctx) => {
    const autos = await ctx.db
      .query("formAutomations")
      .withIndex("by_active", (q) => q.eq("active", true))
      .collect();
    return Promise.all(
      autos.map(async (a) => {
        const template = a.templateId ? await ctx.db.get(a.templateId) : null;
        return { ...a, templateId: template };
      })
    );
  },
});

export const listForUser = internalQuery({
  args: { userId: v.id("users"), isAdmin: v.boolean() },
  handler: async (ctx, { userId, isAdmin }) => {
    const all = await ctx.db.query("formAutomations").collect();
    const filtered = isAdmin ? all : all.filter((a) => a.userId === userId);
    return Promise.all(
      filtered.map(async (a) => {
        const template = a.templateId ? await ctx.db.get(a.templateId) : null;
        const user = a.userId ? await ctx.db.get(a.userId) : null;
        return { ...a, templateId: template, userId: user };
      })
    );
  },
});

export const findById = internalQuery({
  args: { id: v.id("formAutomations") },
  handler: async (ctx, { id }) => ctx.db.get(id),
});

export const create = internalMutation({
  args: {
    userId: v.id("users"),
    templateId: v.id("templates"),
    sheetUrl: v.string(),
    sheetId: v.string(),
    gid: v.string(),
    nameColumn: v.string(),
    emailColumn: v.string(),
    batchId: v.string(),
    emailSubject: v.string(),
    emailMessage: v.string(),
  },
  handler: async (ctx, args) =>
    ctx.db.insert("formAutomations", { ...args, active: true, certCount: 0 }),
});

export const toggle = internalMutation({
  args: { id: v.id("formAutomations"), active: v.boolean() },
  handler: async (ctx, { id, active }) => {
    await ctx.db.patch(id, { active });
    return ctx.db.get(id);
  },
});

export const remove = internalMutation({
  args: { id: v.id("formAutomations") },
  handler: async (ctx, { id }) => ctx.db.delete(id),
});

export const updateStats = internalMutation({
  args: { id: v.id("formAutomations"), newlyGenerated: v.number() },
  handler: async (ctx, { id, newlyGenerated }) => {
    const doc = await ctx.db.get(id);
    if (!doc) return;
    await ctx.db.patch(id, {
      lastChecked: Date.now(),
      certCount: doc.certCount + newlyGenerated,
    });
  },
});
