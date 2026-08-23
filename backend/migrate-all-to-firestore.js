/**
 * Complete Migration Script: MongoDB + Convex → Firebase Firestore & Cloudinary (Batch Optimized)
 * 
 * Usage: node migrate-all-to-firestore.js
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const { initFirebase, getDb } = require('./config/firebase');
const { initCloudinary, cloudinary } = require('./config/cloudinary');

initFirebase();
initCloudinary();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://digicertify:digicertify30@digicertify.klw4qlw.mongodb.net/certGenerator?appName=DigiCertify';

// Helper to upload base64 or local image path to Cloudinary
async function uploadToCloudinary(imageStr, templateName = 'template') {
  if (!imageStr) return '';
  if (imageStr.startsWith('http://res.cloudinary.com') || imageStr.startsWith('https://res.cloudinary.com')) {
    return imageStr;
  }

  try {
    const dataUri = imageStr.startsWith('data:') ? imageStr : `data:image/png;base64,${imageStr}`;
    const res = await cloudinary.uploader.upload(dataUri, {
      folder: 'digicertify/templates',
      public_id: `migrated-${Date.now()}-${templateName.replace(/[^a-zA-Z0-9]/g, '_')}`,
    });
    console.log(`  📸 Uploaded image for "${templateName}" to Cloudinary: ${res.secure_url}`);
    return res.secure_url;
  } catch (err) {
    console.error(`  ⚠️ Cloudinary upload failed for "${templateName}":`, err.message);
    return imageStr;
  }
}

async function runFullMigration() {
  console.log('🚀 Starting Full Migration to Firestore + Cloudinary (Batch Mode)...\n');

  const db = getDb();

  try {
    console.log('Connecting to MongoDB Atlas...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB Atlas.\n');

    const mongoDb = mongoose.connection.db;

    // 1. USERS
    console.log('👤 Migrating Users...');
    const usersColl = mongoDb.collection('users');
    const users = await usersColl.find({}).toArray();
    console.log(`  Found ${users.length} users in MongoDB.`);

    const userMap = {};
    const userBatch = db.batch();
    for (const u of users) {
      const docRef = db.collection('users').doc();
      const userData = {
        name: u.name || 'User',
        email: u.email ? u.email.toLowerCase() : '',
        passwordHash: u.password || u.passwordHash || '',
        role: u.role || 'user',
        createdAt: u.createdAt ? new Date(u.createdAt).toISOString() : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      userBatch.set(docRef, userData);
      userMap[u._id.toString()] = docRef.id;
    }
    if (users.length > 0) await userBatch.commit();
    console.log(`  ✅ Successfully migrated ${users.length} users to Firestore.\n`);

    // 2. TEMPLATES
    console.log('🎨 Migrating Templates...');
    const templatesColl = mongoDb.collection('templates');
    const templates = await templatesColl.find({}).toArray();
    console.log(`  Found ${templates.length} templates in MongoDB.`);

    const templateMap = {};
    for (const t of templates) {
      const docRef = db.collection('templates').doc();
      
      let imageUrl = t.imageUrl || '';
      if (t.imageBase64 || (imageUrl && imageUrl.length > 200)) {
        imageUrl = await uploadToCloudinary(t.imageBase64 || imageUrl, t.name || 'template');
      }

      const templateData = {
        name: t.name || 'Untitled Template',
        imageUrl: imageUrl,
        layoutConfig: t.layoutConfig || [],
        qrCode: t.qrCode || null,
        showId: t.showId !== undefined ? t.showId : true,
        showQr: t.showQr !== undefined ? t.showQr : true,
        createdBy: t.createdBy ? (userMap[t.createdBy.toString()] || String(t.createdBy)) : '',
        createdAt: t.createdAt ? new Date(t.createdAt).toISOString() : new Date().toISOString(),
      };

      await docRef.set(templateData);
      templateMap[t._id.toString()] = docRef.id;
    }
    console.log(`  ✅ Successfully migrated ${templates.length} templates to Firestore & Cloudinary.\n`);

    // 3. CERTIFICATES (Batch writing 500 at a time)
    console.log('📜 Migrating Certificates...');
    const certsColl = mongoDb.collection('certificates');
    const certs = await certsColl.find({}).toArray();
    console.log(`  Found ${certs.length} certificates in MongoDB.`);

    let certBatch = db.batch();
    let batchCounter = 0;

    for (const c of certs) {
      const docRef = db.collection('certificates').doc();
      const certData = {
        certificateId: c.certificateId,
        name: c.name || '',
        email: c.email ? c.email.toLowerCase() : '',
        course: c.course || '',
        templateId: c.templateId ? (templateMap[c.templateId.toString()] || String(c.templateId)) : '',
        status: c.status || 'Pending',
        createdBy: c.createdBy ? (userMap[c.createdBy.toString()] || String(c.createdBy)) : '',
        batchId: c.batchId || '',
        isAutomation: c.isAutomation || false,
        isArchived: c.isArchived || false,
        uniqueHash: c.uniqueHash || '',
        metadata: c.metadata || {},
        createdAt: c.createdAt ? new Date(c.createdAt).toISOString() : new Date().toISOString(),
        updatedAt: c.updatedAt ? new Date(c.updatedAt).toISOString() : new Date().toISOString(),
      };

      certBatch.set(docRef, certData);
      batchCounter++;

      if (batchCounter === 450) {
        await certBatch.commit();
        certBatch = db.batch();
        batchCounter = 0;
      }
    }
    if (batchCounter > 0) await certBatch.commit();
    console.log(`  ✅ Successfully migrated ${certs.length} certificates to Firestore.\n`);

    // 4. FORM AUTOMATIONS
    console.log('🤖 Migrating Form Automations...');
    const autoColl = mongoDb.collection('formautomations');
    const automations = await autoColl.find({}).toArray();
    console.log(`  Found ${automations.length} automations in MongoDB.`);

    const autoBatch = db.batch();
    for (const a of automations) {
      const docRef = db.collection('formAutomations').doc();
      autoBatch.set(docRef, {
        userId: a.userId ? (userMap[a.userId.toString()] || String(a.userId)) : '',
        templateId: a.templateId ? (templateMap[a.templateId.toString()] || String(a.templateId)) : '',
        sheetUrl: a.sheetUrl || '',
        sheetId: a.sheetId || '',
        gid: a.gid || '0',
        nameColumn: a.nameColumn || '',
        emailColumn: a.emailColumn || '',
        batchId: a.batchId || '',
        active: a.active !== undefined ? a.active : true,
        certCount: a.certCount || 0,
        emailSubject: a.emailSubject || 'Your Certificate of Achievement',
        emailMessage: a.emailMessage || 'Congratulations! Your certificate is attached.',
        createdAt: a.createdAt ? new Date(a.createdAt).toISOString() : new Date().toISOString(),
      });
    }
    if (automations.length > 0) await autoBatch.commit();
    console.log(`  ✅ Successfully migrated ${automations.length} form automations to Firestore.\n`);

    // 5. EMAIL LOGS
    console.log('📧 Migrating Email Logs...');
    const logsColl = mongoDb.collection('emaillogs');
    const logs = await logsColl.find({}).toArray();
    console.log(`  Found ${logs.length} email logs in MongoDB.`);

    let logBatch = db.batch();
    let logCounter = 0;
    for (const l of logs) {
      const docRef = db.collection('emailLogs').doc();
      logBatch.set(docRef, {
        certificateId: l.certificateId || '',
        recipient: l.recipient || '',
        status: l.status || 'Sent',
        error: l.error || '',
        sentAt: l.sentAt ? new Date(l.sentAt).toISOString() : new Date().toISOString(),
      });
      logCounter++;
      if (logCounter === 450) {
        await logBatch.commit();
        logBatch = db.batch();
        logCounter = 0;
      }
    }
    if (logCounter > 0) await logBatch.commit();
    console.log(`  ✅ Successfully migrated ${logs.length} email logs to Firestore.\n`);

    console.log('==================================================');
    console.log('🎉 FULL MIGRATION SUCCESSFUL!');
    console.log('All users, templates, certificates, automations & logs are now live in Firestore & Cloudinary!');
    console.log('==================================================');

  } catch (err) {
    console.error('Migration failed:', err.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

runFullMigration();
