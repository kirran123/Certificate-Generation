const { initFirebase, getDb } = require('./config/firebase');
initFirebase();

async function deduplicateUsers() {
  const db = getDb();
  console.log('🧹 Checking Firestore Users for duplicates...');

  const snapshot = await db.collection('users').get();
  console.log(`Total user records before cleanup: ${snapshot.size}`);

  const seenEmails = new Set();
  const docsToDelete = [];

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const email = data.email?.toLowerCase().trim();
    if (!email) continue;

    if (seenEmails.has(email)) {
      docsToDelete.push(doc.ref);
    } else {
      seenEmails.add(email);
    }
  }

  console.log(`Found ${docsToDelete.length} duplicate user documents to remove.`);

  if (docsToDelete.length > 0) {
    const batch = db.batch();
    docsToDelete.forEach(ref => batch.delete(ref));
    await batch.commit();
    console.log(`✅ Removed ${docsToDelete.length} duplicate user accounts.`);
  } else {
    console.log('✅ No duplicate users found.');
  }

  const finalSnap = await db.collection('users').get();
  console.log(`Clean unique users remaining: ${finalSnap.size}`);

  process.exit(0);
}

deduplicateUsers();
