const fs = require('fs');
const path = require('path');
const { initFirebase, getDb } = require('./config/firebase');

initFirebase();

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

async function syncBackup() {
  const db = getDb();
  console.log('🔄 Syncing Firestore data to local backup files...');

  try {
    const usersSnap = await db.collection('users').get();
    const users = usersSnap.docs.map(d => ({ _id: d.id, ...d.data() }));
    fs.writeFileSync(path.join(dataDir, 'users_backup.json'), JSON.stringify(users, null, 2));
    console.log(`✅ Saved ${users.length} users to users_backup.json`);
  } catch (err) {
    console.error('Error backing up users:', err.message);
  }

  try {
    const certsSnap = await db.collection('certificates').get();
    const certs = certsSnap.docs.map(d => ({ _id: d.id, ...d.data() }));
    fs.writeFileSync(path.join(dataDir, 'certificates_backup.json'), JSON.stringify(certs, null, 2));
    console.log(`✅ Saved ${certs.length} certificates to certificates_backup.json`);
  } catch (err) {
    console.error('Error backing up certificates:', err.message);
  }

  try {
    const tmplSnap = await db.collection('templates').get();
    const tmpls = tmplSnap.docs.map(d => ({ _id: d.id, ...d.data() }));
    fs.writeFileSync(path.join(dataDir, 'templates_backup.json'), JSON.stringify(tmpls, null, 2));
    console.log(`✅ Saved ${tmpls.length} templates to templates_backup.json`);
  } catch (err) {
    console.error('Error backing up templates:', err.message);
  }

  process.exit(0);
}

syncBackup();
