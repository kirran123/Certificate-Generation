/**
 * Firestore EmailLog helper with local backup fallback.
 */
const { getDb } = require('../config/firebase');
const fs = require('fs');
const path = require('path');

const backupFilePath = path.join(__dirname, '..', 'data', 'emaillogs_backup.json');

function loadLocalLogs() {
  try {
    if (fs.existsSync(backupFilePath)) {
      return JSON.parse(fs.readFileSync(backupFilePath, 'utf8'));
    }
  } catch (e) {}
  return [];
}

function saveLocalLogs(logs) {
  try {
    const dir = path.dirname(backupFilePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(backupFilePath, JSON.stringify(logs, null, 2));
  } catch (e) {}
}

const col = () => getDb().collection('emailLogs');

const EmailLog = {
  create: async (data) => {
    const now = new Date().toISOString();
    const id = 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    const doc = { ...data, sentAt: now, createdAt: now };

    try {
      await col().doc(id).set(doc);
    } catch (err) {
      console.warn('[EmailLog.create] Firestore error:', err.message);
    }

    const local = loadLocalLogs();
    const newLog = { _id: id, ...doc };
    local.unshift(newLog);
    saveLocalLogs(local);
    return newLog;
  },

  find: async (filter = {}) => {
    let query = col();
    if (filter.certificateId) query = query.where('certificateId', '==', filter.certificateId);
    
    try {
      let q = query.orderBy('sentAt', 'desc');
      if (filter.limit) q = q.limit(filter.limit);
      const snap = await q.get();
      const docs = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
      saveLocalLogs(docs);
      return docs;
    } catch (e) {
      const local = loadLocalLogs();
      let docs = filter.certificateId ? local.filter(l => l.certificateId === filter.certificateId) : local;
      docs.sort((a, b) => new Date(b.sentAt || 0) - new Date(a.sentAt || 0));
      return filter.limit ? docs.slice(0, filter.limit) : docs;
    }
  },

  countDocuments: async () => {
    try {
      const snap = await col().get();
      return snap.size;
    } catch (e) {
      const local = loadLocalLogs();
      return local.length;
    }
  },
};

module.exports = EmailLog;
