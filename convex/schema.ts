import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    name: v.string(),
    email: v.string(),
    passwordHash: v.string(),
    role: v.union(v.literal("admin"), v.literal("user")),
  }).index("by_email", ["email"]),

  templates: defineTable({
    name: v.string(),
    imageUrl: v.string(),
    imageStorageId: v.optional(v.id("_storage")),
    imageBase64: v.optional(v.string()),
    layoutConfig: v.any(),
    qrCode: v.optional(v.any()),
    showId: v.optional(v.boolean()),
    showQr: v.optional(v.boolean()),
    createdBy: v.id("users"),
  }),

  certificates: defineTable({
    certificateId: v.string(),
    name: v.string(),
    email: v.optional(v.string()),
    course: v.optional(v.string()),
    templateId: v.id("templates"),
    pdfUrl: v.optional(v.string()),
    status: v.union(v.literal("Pending"), v.literal("Sent"), v.literal("Failed")),
    createdBy: v.id("users"),
    batchId: v.optional(v.string()),
    isAutomation: v.optional(v.boolean()),
    isArchived: v.optional(v.boolean()),
    uniqueHash: v.optional(v.string()),
    metadata: v.optional(v.any()),
  })
    .index("by_certificateId", ["certificateId"])
    .index("by_batchId", ["batchId"])
    .index("by_createdBy", ["createdBy"])
    .index("by_uniqueHash", ["uniqueHash"])
    .index("by_isArchived", ["isArchived"]),

  emailLogs: defineTable({
    certificateId: v.string(),
    recipient: v.string(),
    status: v.union(v.literal("Sent"), v.literal("Failed")),
    error: v.optional(v.string()),
  }),

  formAutomations: defineTable({
    userId: v.id("users"),
    templateId: v.id("templates"),
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
  }).index("by_active", ["active"]),

  feedback: defineTable({
    name: v.string(),
    email: v.optional(v.string()),
    type: v.string(),
    message: v.string(),
    certificateId: v.optional(v.string()),
  }),

  templateImages: defineTable({
    templateId: v.id("templates"),
    imageBase64: v.string(),
  }).index("by_templateId", ["templateId"]),
});
