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
    // Sort by sentAt descending if needed
    const snap = await query.orderBy('sentAt', 'desc').get();
    return snap.docs.map(d => ({ _id: d.id, ...d.data() }));
  },

  countDocuments: async () => {
    const snap = await col().get();
    return snap.size;
  },
};

module.exports = EmailLog;
