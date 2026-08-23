const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://digicertify:digicertify30@digicertify.klw4qlw.mongodb.net/certGenerator?appName=DigiCertify';

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

async function dumpBackup() {
  console.log('📦 Connecting to MongoDB Atlas to fetch data snapshots...');
  try {
    await mongoose.connect(MONGODB_URI);
    const mongoDb = mongoose.connection.db;

    // 1. Users
    const users = await mongoDb.collection('users').find({}).toArray();
    const cleanUsers = users.map(u => ({
      _id: u._id.toString(),
      name: u.name || 'User',
      email: u.email ? u.email.toLowerCase().trim() : '',
      passwordHash: u.password || u.passwordHash || '',
      role: u.role || 'user',
      createdAt: u.createdAt ? new Date(u.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }));
    fs.writeFileSync(path.join(dataDir, 'users_backup.json'), JSON.stringify(cleanUsers, null, 2));
    console.log(`✅ Exported ${cleanUsers.length} Users to users_backup.json`);

    // 2. Templates
    const templates = await mongoDb.collection('templates').find({}).toArray();
    const cleanTemplates = templates.map(t => ({
      _id: t._id.toString(),
      name: t.name || 'Untitled Template',
      imageUrl: t.imageUrl || '',
      layoutConfig: t.layoutConfig || [],
      showId: t.showId !== undefined ? t.showId : true,
      showQr: t.showQr !== undefined ? t.showQr : true,
      createdBy: t.createdBy ? String(t.createdBy) : '',
      createdAt: t.createdAt ? new Date(t.createdAt).toISOString() : new Date().toISOString()
    }));
    fs.writeFileSync(path.join(dataDir, 'templates_backup.json'), JSON.stringify(cleanTemplates, null, 2));
    console.log(`✅ Exported ${cleanTemplates.length} Templates to templates_backup.json`);

    // 3. Certificates
    const certs = await mongoDb.collection('certificates').find({}).toArray();
    const seenCerts = new Set();
    const cleanCerts = [];
    for (const c of certs) {
      if (seenCerts.has(c.certificateId)) continue;
      seenCerts.add(c.certificateId);
      cleanCerts.push({
        _id: c._id.toString(),
        certificateId: c.certificateId,
        name: c.name || '',
        email: c.email ? c.email.toLowerCase().trim() : '',
        course: c.course || '',
        templateId: c.templateId ? String(c.templateId) : '',
        status: c.status || 'Pending',
        createdBy: c.createdBy ? String(c.createdBy) : '',
        batchId: c.batchId || '',
        isAutomation: c.isAutomation || false,
        isArchived: c.isArchived || false,
        uniqueHash: c.uniqueHash || '',
        createdAt: c.createdAt ? new Date(c.createdAt).toISOString() : new Date().toISOString(),
        updatedAt: c.updatedAt ? new Date(c.updatedAt).toISOString() : new Date().toISOString()
      });
    }
    fs.writeFileSync(path.join(dataDir, 'certificates_backup.json'), JSON.stringify(cleanCerts, null, 2));
    console.log(`✅ Exported ${cleanCerts.length} Unique Certificates to certificates_backup.json`);

    // 4. Email Logs
    const logs = await mongoDb.collection('emaillogs').find({}).toArray();
    const cleanLogs = logs.map(l => ({
      _id: l._id.toString(),
      certificateId: l.certificateId || '',
      recipient: l.recipient || '',
      status: l.status || 'Sent',
      error: l.error || '',
      sentAt: l.sentAt ? new Date(l.sentAt).toISOString() : new Date().toISOString()
    }));
    fs.writeFileSync(path.join(dataDir, 'emaillogs_backup.json'), JSON.stringify(cleanLogs, null, 2));
    console.log(`✅ Exported ${cleanLogs.length} Email Logs to emaillogs_backup.json`);

    // 5. Feedback
    let feedback = [];
    try {
      feedback = await mongoDb.collection('feedbacks').find({}).toArray();
    } catch (e) {}
    const cleanFeedback = feedback.map(f => ({
      _id: f._id.toString(),
      name: f.name || 'Anonymous',
      email: f.email || '',
      type: f.type || 'Suggestion',
      message: f.message || '',
      createdAt: f.createdAt ? new Date(f.createdAt).toISOString() : new Date().toISOString()
    }));
    fs.writeFileSync(path.join(dataDir, 'feedback_backup.json'), JSON.stringify(cleanFeedback, null, 2));
    console.log(`✅ Exported ${cleanFeedback.length} Feedbacks to feedback_backup.json`);

    console.log('\n🎉 Local JSON backup files updated with 100% real data!');
  } catch (err) {
    console.error('Error dumping backup from MongoDB:', err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

dumpBackup();
