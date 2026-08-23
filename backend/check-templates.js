const { initFirebase, getDb } = require('./config/firebase');
initFirebase();

async function inspect() {
  const db = getDb();
  const snapshot = await db.collection('templates').get();
  snapshot.docs.forEach(doc => {
    const d = doc.data();
    console.log(`- Template ID: ${doc.id} | Name: "${d.name}" | imageUrl: "${d.imageUrl ? d.imageUrl.substring(0, 80) : 'NONE'}"`);
  });
  process.exit(0);
}

inspect();
