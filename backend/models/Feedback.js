/**
 * Firestore Feedback helper with local backup fallback.
 */
const { getDb } = require('../config/firebase');
const fs = require('fs');
const path = require('path');

const backupFilePath = path.join(__dirname, '..', 'data', 'feedback_backup.json');

function loadLocalFeedback() {
  try {
    if (fs.existsSync(backupFilePath)) {
      return JSON.parse(fs.readFileSync(backupFilePath, 'utf8'));
    }
  } catch (e) {}
  return [];
}

function saveLocalFeedback(fb) {
  try {
    const dir = path.dirname(backupFilePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(backupFilePath, JSON.stringify(fb, null, 2));
  } catch (e) {}
}

const col = () => getDb().collection('feedback');

const Feedback = {
  create: async (data) => {
    const now = new Date().toISOString();
    const id = 'fb_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    const doc = { ...data, type: data.type || 'Suggestion', createdAt: now };

    try {
      await col().doc(id).set(doc);
    } catch (err) {
      console.warn('[Feedback.create] Firestore error:', err.message);
    }

    const local = loadLocalFeedback();
    const newFb = { _id: id, ...doc };
    local.unshift(newFb);
    saveLocalFeedback(local);
    return newFb;
  },

  find: async (filter = {}) => {
    let query = col();
    try {
      let q = query.orderBy('createdAt', 'desc');
      if (filter.limit) q = q.limit(filter.limit);
      const snap = await q.get();
      const docs = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
      saveLocalFeedback(docs);
      return docs;
    } catch (e) {
      const local = loadLocalFeedback();
      local.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      return filter.limit ? local.slice(0, filter.limit) : local;
    }
  },

  findById: async (id) => {
    if (!id) return null;
    try {
      const doc = await col().doc(String(id)).get();
      if (doc.exists) return { _id: doc.id, ...doc.data() };
    } catch (e) {}
    const local = loadLocalFeedback();
    return local.find(f => f._id === String(id)) || null;
  },

  deleteOne: async (id) => {
    if (!id) return;
    try {
      await col().doc(String(id)).delete();
    } catch (e) {}
    const local = loadLocalFeedback();
    const filtered = local.filter(f => f._id !== String(id));
    saveLocalFeedback(filtered);
  },
};

module.exports = Feedback;
