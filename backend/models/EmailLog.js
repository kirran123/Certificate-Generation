/**
 * Firestore EmailLog helper — replaces Mongoose EmailLog model.
 */
const { getDb } = require('../config/firebase');

const col = () => getDb().collection('emailLogs');

const EmailLog = {
  create: async (data) => {
    const now = new Date().toISOString();
    const ref = col().doc();
    const doc = { ...data, sentAt: now, createdAt: now };
    await ref.set(doc);
    return { _id: ref.id, ...doc };
  },

  find: async (filter = {}) => {
    let query = col();
    if (filter.certificateId) query = query.where('certificateId', '==', filter.certificateId);
    
    try {
      let q = query.orderBy('sentAt', 'desc');
      if (filter.limit) q = q.limit(filter.limit);
      const snap = await q.get();
      return snap.docs.map(d => ({ _id: d.id, ...d.data() }));
    } catch (e) {
      // Fallback if index missing or simple query
      const snap = await query.get();
      const docs = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
      docs.sort((a, b) => new Date(b.sentAt || 0) - new Date(a.sentAt || 0));
      return filter.limit ? docs.slice(0, filter.limit) : docs;
    }
  },

  countDocuments: async () => {
    const snap = await col().get();
    return snap.size;
  },
};

module.exports = EmailLog;
