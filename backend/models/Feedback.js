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
    try {
      let q = query.orderBy('createdAt', 'desc');
      if (filter.limit) q = q.limit(filter.limit);
      const snap = await q.get();
      return snap.docs.map(d => ({ _id: d.id, ...d.data() }));
    } catch (e) {
      const snap = await query.get();
      const docs = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
      docs.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      return filter.limit ? docs.slice(0, filter.limit) : docs;
    }
  },

  findById: async (id) => {
    if (!id) return null;
    try {
      const doc = await col().doc(String(id)).get();
      if (!doc.exists) return null;
      return { _id: doc.id, ...doc.data() };
    } catch (e) {
      return null;
    }
  },

  deleteOne: async (id) => {
    if (!id) return;
    await col().doc(String(id)).delete();
  },
};

module.exports = Feedback;
