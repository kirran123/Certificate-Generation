/**
 * Firestore Feedback helper — replaces Mongoose Feedback model.
 */
const { getDb } = require('../config/firebase');

const col = () => getDb().collection('feedback');

const Feedback = {
  create: async (data) => {
    const now = new Date().toISOString();
    const ref = col().doc();
    const doc = { ...data, type: data.type || 'Suggestion', createdAt: now };
    await ref.set(doc);
    return { _id: ref.id, ...doc };
  },

  find: async (filter = {}) => {
    let query = col();
    const snap = await query.orderBy('createdAt', 'desc').get();
    return snap.docs.map(d => ({ _id: d.id, ...d.data() }));
  },

  findById: async (id) => {
    const doc = await col().doc(id).get();
    if (!doc.exists) return null;
    return { _id: doc.id, ...doc.data() };
  },

  deleteOne: async (id) => {
    await col().doc(id).delete();
  },
};

module.exports = Feedback;
