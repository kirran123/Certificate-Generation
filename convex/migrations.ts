import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const splitBatch = mutation({
  args: { cursor: v.optional(v.string()), limit: v.number() },
  handler: async (ctx, { cursor, limit }) => {
    const page = await ctx.db.query("templates").paginate({
      numItems: limit,
      cursor: cursor || null,
    });
    let updated = 0;
    for (const t of page.page) {
      // Accessing t.imageBase64 is safe because it is typed as optional string in schema
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
