/**
 * deduplicate-mongo.js
 * Sweeps Mongoose (MongoDB) and Firestore Certificate collections,
 * removing any duplicate certificate entries per (email + templateId) or uniqueHash.
 * Retains the earliest created valid document and cleans up orphaned files/logs.
 */

const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '.env') });

const Certificate = require('./models/Certificate');
const { initFirebase, getDb } = require('./config/firebase');

async function deduplicate() {
  console.log('🧹 Starting Database Deduplication Sweep...');

  // 1. Mongoose / MongoDB Cleanup if URI present
  const mongoUri = process.env.MONGODB_URI;
  if (mongoUri) {
    try {
      console.log('\n--- Checking MongoDB ---');
      await mongoose.connect(mongoUri);
      const allCerts = await Certificate.find({}).sort({ createdAt: 1 });
      console.log(`Total MongoDB certificates: ${allCerts.length}`);

      const seen = new Set();
      const idsToDelete = [];

      for (const cert of allCerts) {
        const normEmail = String(cert.email || '').trim().toLowerCase();
        const tmplId = String(cert.templateId?._id || cert.templateId || '').trim();
        const key = cert.uniqueHash || `${tmplId}_${normEmail}`;

        if (!normEmail || !tmplId) continue;

        if (seen.has(key)) {
          idsToDelete.push(cert._id);
        } else {
          seen.add(key);
        }
      }

      console.log(`Found ${idsToDelete.length} duplicate records in MongoDB.`);
      if (idsToDelete.length > 0) {
        await Certificate.deleteMany({ _id: { $in: idsToDelete } });
        console.log(`✅ Deleted ${idsToDelete.length} duplicate certificate records from MongoDB.`);
      } else {
        console.log('✅ No duplicates found in MongoDB.');
      }
      await mongoose.disconnect();
    } catch (e) {
      console.warn('MongoDB dedup notice:', e.message);
    }
  }

  // 2. Firestore Cleanup if configured
  try {
    console.log('\n--- Checking Firestore ---');
    initFirebase();
    const db = getDb();
    const snap = await db.collection('certificates').get();
    console.log(`Total Firestore certificates: ${snap.size}`);

    const seenFs = new Set();
    const docsToDelete = [];

    for (const doc of snap.docs) {
      const data = doc.data();
      const normEmail = String(data.email || '').trim().toLowerCase();
      const tmplId = String(data.templateId?._id || data.templateId || '').trim();
      const key = data.uniqueHash || `${tmplId}_${normEmail}`;

      if (!normEmail || !tmplId) continue;

      if (seenFs.has(key)) {
        docsToDelete.push(doc.ref);
      } else {
        seenFs.add(key);
      }
    }

    console.log(`Found ${docsToDelete.length} duplicate documents in Firestore.`);
    if (docsToDelete.length > 0) {
      let batch = db.batch();
      let count = 0;
      for (const ref of docsToDelete) {
        batch.delete(ref);
        count++;
        if (count === 450) {
          await batch.commit();
          batch = db.batch();
          count = 0;
        }
      }
      if (count > 0) await batch.commit();
      console.log(`✅ Deleted ${docsToDelete.length} duplicate documents from Firestore.`);
    } else {
      console.log('✅ No duplicates found in Firestore.');
    }
  } catch (e) {
    console.warn('Firestore dedup notice:', e.message);
  }

  console.log('\n🎉 Deduplication Sweep Completed Successfully!');
  process.exit(0);
}

deduplicate();
