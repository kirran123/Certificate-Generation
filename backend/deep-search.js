const { initFirebase, getDb } = require('./config/firebase');
initFirebase();

async function searchAll() {
  const db = getDb();
  console.log('🔍 Searching ALL Firestore certificates for "283273"...');
  
  const snap = await db.collection('certificates').get();
  console.log(`Total certificates in Firestore right now: ${snap.size}`);

  let found = false;
  snap.docs.forEach(doc => {
    const d = doc.data();
    if (d.certificateId && d.certificateId.includes('283273')) {
      console.log('🎉 FOUND EXACT MATCH IN FIRESTORE:');
      console.log(JSON.stringify({ id: doc.id, ...d }, null, 2));
      found = true;
    }
  });

  if (!found) {
    console.log('⚠️ CERT283273 not found. Here are the 5 most recently created certificates in Firestore:');
    const sorted = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);
    console.log(JSON.stringify(sorted, null, 2));
  }

  process.exit(0);
}

searchAll();
