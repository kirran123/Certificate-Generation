const { initFirebase, getDb } = require('./config/firebase');
initFirebase();

async function checkCertificates() {
  const db = getDb();

  console.log('🔍 Searching Firestore for Certificate ID: CERT283273...\n');
  const snap = await db.collection('certificates').where('certificateId', '==', 'CERT283273').get();

  if (snap.empty) {
    console.log('❌ CERT283273 not found in Firestore. Searching all recent certificates...');
  } else {
    snap.docs.forEach(doc => {
      console.log('✅ FOUND CERTIFICATE IN FIRESTORE:');
      console.log(JSON.stringify(doc.data(), null, 2));
    });
  }

  console.log('\n📜 Fetching latest 10 certificates from Firestore...');
  const latestSnap = await db.collection('certificates').orderBy('createdAt', 'desc').limit(10).get();
  console.log(`Total latest documents fetched: ${latestSnap.size}`);
  latestSnap.docs.forEach(doc => {
    const d = doc.data();
    console.log(`- ID: ${d.certificateId} | Name: "${d.name}" | Email: "${d.email}" | CreatedAt: ${d.createdAt} | TemplateId: ${d.templateId}`);
  });

  process.exit(0);
}

checkCertificates();
