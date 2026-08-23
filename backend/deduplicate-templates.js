const { initFirebase, getDb } = require('./config/firebase');
initFirebase();

async function deduplicateTemplates() {
  const db = getDb();
  console.log('🧹 Checking Firestore Templates for duplicates...');

  const snapshot = await db.collection('templates').get();
  console.log(`Total template records in Firestore before cleanup: ${snapshot.size}`);

  const seenKeys = new Set();
  const docsToDelete = [];

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const key = `${data.name}_${data.imageUrl}`;
    if (seenKeys.has(key)) {
      docsToDelete.push(doc.ref);
    } else {
      seenKeys.add(key);
    }
  }

  console.log(`Found ${docsToDelete.length} duplicate templates to remove.`);

  if (docsToDelete.length > 0) {
    let batch = db.batch();
    docsToDelete.forEach(ref => batch.delete(ref));
    await batch.commit();
    console.log(`✅ Removed ${docsToDelete.length} duplicate templates.`);
  } else {
    console.log('✅ No template duplicates found.');
  }

  process.exit(0);
}

deduplicateTemplates();
