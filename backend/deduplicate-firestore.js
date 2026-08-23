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
  const docsToDelete = [];
  let uniqueCount = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const certId = data.certificateId;
    const hashKey = data.uniqueHash || `${certId}_${data.email}_${data.batchId}`;

    if ((certId && seenIds.has(certId)) || (hashKey && seenHashes.has(hashKey))) {
      docsToDelete.push(doc.ref);
    } else {
      if (certId) seenIds.add(certId);
      if (hashKey) seenHashes.add(hashKey);
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

  process.exit(0);
}

deduplicateCertificates();
