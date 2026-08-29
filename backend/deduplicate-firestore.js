/**
 * Deduplicate Firestore Certificates Script
 * Removes duplicate certificate documents that were created when migration was run multiple times.
 */

const { initFirebase, getDb } = require('./config/firebase');
initFirebase();

async function deduplicateCertificates() {
  const db = getDb();
  console.log('🧹 Starting Firestore Certificate Deduplication...\n');

  const snapshot = await db.collection('certificates').get();
  console.log(`Total certificate records in Firestore before deduplication: ${snapshot.size}`);

  const seenIds = new Set();
  const seenHashes = new Set();
  const seenEmailTmplBatch = new Set();
  const docsToDelete = [];
  let uniqueCount = 0;

  function normalizeEmail(rawEmail) {
    if (!rawEmail) return '';
    let email = String(rawEmail).replace(/\s+/g, '');
    email = email.replace(/^[<"'\s]+|[>'"\s]+$/g, '');
    email = email.replace(/[\s.,;:)]+$/g, '');
    email = email.replace(/^[\s.,;:(]+/g, '');
    if (email.includes('@')) {
      const parts = email.split('@');
      const local = parts[0];
      const domain = parts.slice(1).join('@').replace(/\.{2,}/g, '.').replace(/^\.+|\.+$/g, '');
      email = `${local}@${domain}`;
    }
    return email.toLowerCase();
  }

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const certId = data.certificateId;
    const hashKey = data.uniqueHash || (certId ? `${certId}_${data.email}_${data.batchId}` : null);
    const emailNorm = normalizeEmail(data.email);
    const tmplId = String(data.templateId?._id || data.templateId || '');
    const baseBatch = String(data.batchId || '').replace(/\s*\[Run \d{2}:\d{2}\]/, '').trim();
    const comboKey = emailNorm && tmplId ? `${emailNorm}_${tmplId}_${baseBatch}` : null;

    const isDuplicate =
      (certId && seenIds.has(certId)) ||
      (hashKey && seenHashes.has(hashKey)) ||
      (comboKey && seenEmailTmplBatch.has(comboKey));

    if (isDuplicate) {
      docsToDelete.push(doc.ref);
    } else {
      if (certId) seenIds.add(certId);
      if (hashKey) seenHashes.add(hashKey);
      if (comboKey) seenEmailTmplBatch.add(comboKey);
      uniqueCount++;
    }
  }

  console.log(`\nFound ${docsToDelete.length} duplicate documents out of ${snapshot.size} total.`);
  console.log(`Unique certificates to keep: ${uniqueCount}`);

  if (docsToDelete.length > 0) {
    console.log('Deleting duplicate documents in batches...');
    let batch = db.batch();
    let counter = 0;
    let totalDeleted = 0;

    for (const ref of docsToDelete) {
      batch.delete(ref);
      counter++;
      if (counter === 450) {
        await batch.commit();
        totalDeleted += counter;
        console.log(`  Deleted batch of ${counter} duplicates (Total: ${totalDeleted})...`);
        batch = db.batch();
        counter = 0;
      }
    }
    if (counter > 0) {
      await batch.commit();
      totalDeleted += counter;
      console.log(`  Deleted final batch of ${counter} duplicates.`);
    }

    console.log(`\n==================================================`);
    console.log(`🎉 DEDUPLICATION COMPLETE! Removed ${totalDeleted} duplicate documents.`);
    console.log(`Clean unique certificates remaining: ${uniqueCount}`);
    console.log(`==================================================`);
  } else {
    console.log('\n✅ No duplicates found!');
  }

  // Synchronize certificates_backup.json
  try {
    const fs = require('fs');
    const path = require('path');
    const backupFilePath = path.join(__dirname, 'data', 'certificates_backup.json');
    if (fs.existsSync(backupFilePath)) {
      const cleanSnap = await db.collection('certificates').get();
      const cleanList = cleanSnap.docs.map(d => ({ _id: d.id, ...d.data() }));
      fs.writeFileSync(backupFilePath, JSON.stringify(cleanList, null, 2));
      console.log(`Synchronized certificates_backup.json with ${cleanList.length} clean unique certificates.`);
    }
  } catch (e) {
    console.warn('Backup sync error:', e.message);
  }

  process.exit(0);
}

deduplicateCertificates();
