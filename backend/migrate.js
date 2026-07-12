/**
 * MongoDB to Convex Data Migration Script
 * Run this from the backend folder using: node migrate.js
 */
const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");
const { ConvexHttpClient } = require("convex/browser");

// 1. Load Environment Variables (.env is in the same backend folder)
require("dotenv").config();

// Read Convex URL from .env.local in parent workspace root
const envLocalPath = path.join(__dirname, "../.env.local");
let convexUrl = process.env.CONVEX_URL;
if (fs.existsSync(envLocalPath)) {
  const envLocal = fs.readFileSync(envLocalPath, "utf8");
  const match = envLocal.match(/^CONVEX_URL=(.+)$/m);
  if (match) convexUrl = match[1].trim();
}

if (!process.env.MONGODB_URI) {
  console.error("❌ Error: MONGODB_URI not found in backend/.env");
  process.exit(1);
}
if (!convexUrl) {
  console.error("❌ Error: CONVEX_URL not found in .env.local or environment");
  process.exit(1);
}

// Dynamically define Convex API endpoints
const api = {
  migrations: {
    clearTable: "migrations:clearTable",
    insertUsers: "migrations:insertUsers",
    insertTemplates: "migrations:insertTemplates",
    insertCertificates: "migrations:insertCertificates",
    insertAutomations: "migrations:insertAutomations",
    insertFeedback: "migrations:insertFeedback",
    insertEmailLogs: "migrations:insertEmailLogs",
  }
};

// Import Mongoose Models (relative to backend folder)
const User = require("./models/User");
const Template = require("./models/Template");
const Certificate = require("./models/Certificate");
const FormAutomation = require("./models/FormAutomation");
const Feedback = require("./models/Feedback");
const EmailLog = require("./models/EmailLog");

async function main() {
  console.log("🚀 Starting data migration...");
  console.log(`- MongoDB URI: ${process.env.MONGODB_URI.split("@").pop()}`);
  console.log(`- Convex URL: ${convexUrl}`);

  // Connect to MongoDB
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("✅ Connected to MongoDB Atlas.");

  // Diagnostics: List databases and collections
  try {
    const admin = new mongoose.mongo.Admin(mongoose.connection.db);
    const dbList = await admin.listDatabases();
    console.log("📁 Databases in MongoDB Cluster:", dbList.databases.map(d => `${d.name} (${(d.sizeOnDisk / 1024 / 1024).toFixed(2)} MB)`).join(", "));
    
    console.log(`📂 Current Database Collections in "${mongoose.connection.db.databaseName}":`);
    const collections = await mongoose.connection.db.listCollections().toArray();
    for (const coll of collections) {
      const count = await mongoose.connection.db.collection(coll.name).countDocuments({});
      console.log(`  - ${coll.name}: ${count} documents`);
    }
  } catch (err) {
    console.warn("⚠️ Could not list databases/collections:", err.message);
  }

  // Connect to Convex
  const client = new ConvexHttpClient(convexUrl);
  console.log("✅ Connected to Convex Client.");

  // Clear existing collections to make migration clean & idempotent
  console.log("\n🧹 Clearing existing Convex tables...");
  const tables = ["users", "templates", "certificates", "formAutomations", "emailLogs", "feedback"];
  for (const t of tables) {
    const deletedCount = await client.mutation(api.migrations.clearTable, { tableName: t });
    console.log(`  - Cleared ${deletedCount} records from table "${t}"`);
  }

  // ── 1. MIGRATE USERS ──
  console.log("\n👤 Migrating Users...");
  const dbUsers = await User.find().lean();
  console.log(`  Found ${dbUsers.length} users in MongoDB.`);
  if (!dbUsers.length) {
    console.error("❌ Error: No users found. Migration aborted.");
    process.exit(1);
  }
  const usersPayload = dbUsers.map(u => ({
    oldId: u._id.toString(),
    name: u.name,
    email: u.email,
    passwordHash: u.password,
    role: u.role === "admin" ? "admin" : "user",
  }));
  const userMap = await client.mutation(api.migrations.insertUsers, { users: usersPayload });
  console.log(`  ✅ Successfully migrated ${Object.keys(userMap).length} users.`);

  // ── 2. MIGRATE TEMPLATES ──
  console.log("\n🎨 Migrating Templates...");
  const dbTemplates = await Template.find().lean();
  console.log(`  Found ${dbTemplates.length} templates in MongoDB.`);
  let templateMap = {};
  if (dbTemplates.length > 0) {
    const templatesPayload = dbTemplates.map(t => {
      const createdBy = userMap[t.createdBy ? t.createdBy.toString() : ""] || Object.values(userMap)[0];
      return {
        oldId: t._id.toString(),
        name: t.name,
        imageUrl: t.imageUrl,
        imageBase64: t.imageBase64 || undefined,
        layoutConfig: t.layoutConfig,
        qrCode: t.qrCode || undefined,
        showId: t.showId !== undefined ? t.showId : true,
        showQr: t.showQr !== undefined ? t.showQr : true,
        createdBy,
      };
    });
    templateMap = {};
    const tBatchSize = 2;
    for (let i = 0; i < templatesPayload.length; i += tBatchSize) {
      const batch = templatesPayload.slice(i, i + tBatchSize);
      const batchMap = await client.mutation(api.migrations.insertTemplates, { templates: batch });
      templateMap = { ...templateMap, ...batchMap };
      console.log(`  - Migrated templates ${i + 1} to ${Math.min(i + tBatchSize, templatesPayload.length)}`);
    }
    console.log(`  ✅ Successfully migrated ${Object.keys(templateMap).length} templates.`);
  } else {
    console.log("  ⚠️ No templates to migrate.");
  }

  // ── 3. MIGRATE CERTIFICATES ──
  console.log("\n🎓 Migrating Certificates...");
  const dbCertificates = await Certificate.find().lean();
  console.log(`  Found ${dbCertificates.length} certificates in MongoDB.`);
  if (dbCertificates.length > 0) {
    const defaultUser = Object.values(userMap)[0];
    const defaultTemplate = Object.values(templateMap)[0];

    const certificatesPayload = dbCertificates.map(c => {
      const createdBy = userMap[c.createdBy ? c.createdBy.toString() : ""] || defaultUser;
      const templateId = templateMap[c.templateId ? c.templateId.toString() : ""] || defaultTemplate;
      
      // Convert metadata Map to plain object
      let metadata = undefined;
      if (c.metadata) {
        if (c.metadata instanceof Map) {
          metadata = Object.fromEntries(c.metadata);
        } else if (typeof c.metadata === "object") {
          metadata = c.metadata;
        }
      }

      return {
        certificateId: c.certificateId,
        name: c.name,
        email: c.email || undefined,
        course: c.course || undefined,
        templateId,
        pdfUrl: c.pdfUrl || undefined,
        status: c.status === "Sent" || c.status === "Failed" ? c.status : "Pending",
        createdBy,
        batchId: c.batchId || undefined,
        isAutomation: c.isAutomation || false,
        isArchived: c.isArchived || false,
        uniqueHash: c.uniqueHash || undefined,
        metadata,
      };
    });

    const batchSize = 100;
    let certCount = 0;
    for (let i = 0; i < certificatesPayload.length; i += batchSize) {
      const batch = certificatesPayload.slice(i, i + batchSize);
      const inserted = await client.mutation(api.migrations.insertCertificates, { certificates: batch });
      certCount += inserted;
      console.log(`  - Migrated certificates ${i + 1} to ${Math.min(i + batchSize, certificatesPayload.length)}`);
    }
    console.log(`  ✅ Successfully migrated ${certCount} certificates.`);
  } else {
    console.log("  ⚠️ No certificates to migrate.");
  }

  // ── 4. MIGRATE AUTOMATIONS ──
  console.log("\n🤖 Migrating Automations...");
  const dbAutomations = await FormAutomation.find().lean();
  console.log(`  Found ${dbAutomations.length} automations in MongoDB.`);
  if (dbAutomations.length > 0) {
    const defaultUser = Object.values(userMap)[0];
    const defaultTemplate = Object.values(templateMap)[0];

    const automationsPayload = dbAutomations.map(a => {
      const userId = userMap[a.userId ? a.userId.toString() : ""] || defaultUser;
      const templateId = templateMap[a.templateId ? a.templateId.toString() : ""] || defaultTemplate;
      return {
        userId,
        templateId,
        sheetUrl: a.sheetUrl,
        sheetId: a.sheetId,
        gid: a.gid || "0",
        nameColumn: a.nameColumn,
        emailColumn: a.emailColumn,
        batchId: a.batchId,
        active: a.active !== undefined ? a.active : true,
        lastChecked: a.lastChecked ? new Date(a.lastChecked).getTime() : undefined,
        certCount: a.certCount || 0,
        emailSubject: a.emailSubject || "Your Certificate of Achievement",
        emailMessage: a.emailMessage || "Congratulations! Your certificate is attached.",
      };
    });
    const inserted = await client.mutation(api.migrations.insertAutomations, { automations: automationsPayload });
    console.log(`  ✅ Successfully migrated ${inserted} automations.`);
  } else {
    console.log("  ⚠️ No automations to migrate.");
  }

  // ── 5. MIGRATE FEEDBACK ──
  console.log("\n💬 Migrating Feedback...");
  const dbFeedback = await Feedback.find().lean();
  console.log(`  Found ${dbFeedback.length} feedback entries in MongoDB.`);
  if (dbFeedback.length > 0) {
    const feedbackPayload = dbFeedback.map(f => ({
      name: f.name,
      email: f.email || undefined,
      type: f.type || "Suggestion",
      message: f.message,
      certificateId: f.certificateId || undefined,
    }));
    const inserted = await client.mutation(api.migrations.insertFeedback, { feedback: feedbackPayload });
    console.log(`  ✅ Successfully migrated ${inserted} feedback entries.`);
  } else {
    console.log("  ⚠️ No feedback to migrate.");
  }

  // ── 6. MIGRATE EMAIL LOGS ──
  console.log("\n📧 Migrating Email Logs...");
  const dbEmailLogs = await EmailLog.find().lean();
  console.log(`  Found ${dbEmailLogs.length} email logs in MongoDB.`);
  if (dbEmailLogs.length > 0) {
    const emailLogsPayload = dbEmailLogs.map(l => ({
      certificateId: l.certificateId,
      recipient: l.recipient,
      status: l.status === "Sent" || l.status === "Failed" ? l.status : "Sent",
      error: l.error || undefined,
    }));

    const batchSize = 100;
    let logCount = 0;
    for (let i = 0; i < emailLogsPayload.length; i += batchSize) {
      const batch = emailLogsPayload.slice(i, i + batchSize);
      const inserted = await client.mutation(api.migrations.insertEmailLogs, { logs: batch });
      logCount += inserted;
      console.log(`  - Migrated email logs ${i + 1} to ${Math.min(i + batchSize, emailLogsPayload.length)}`);
    }
    console.log(`  ✅ Successfully migrated ${logCount} email logs.`);
  } else {
    console.log("  ⚠️ No email logs to migrate.");
  }

  console.log("\n🎉 Migration completed successfully!");
  await mongoose.disconnect();
}

main().catch(err => {
  console.error("\n❌ Migration failed:", err);
  mongoose.disconnect();
  process.exit(1);
});
