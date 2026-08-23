const { initFirebase, getDb } = require('./config/firebase');
initFirebase();

async function verify() {
  const db = getDb();
  const certsSnap = await db.collection('certificates').get();
  const templatesSnap = await db.collection('templates').get();

  console.log(`📊 FIRESTORE DATABASE HEALTH CHECK:`);
  console.log(`- Unique Certificates: ${certsSnap.size}`);
  console.log(`- Unique Templates: ${templatesSnap.size}`);

  process.exit(0);
}

verify();
