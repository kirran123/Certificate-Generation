/**
 * Firestore Template helper — replaces Mongoose Template model.
 * imageUrl stores a Cloudinary URL (never base64).
 */
const { getDb } = require('../config/firebase');

const col = () => getDb().collection('templates');

const Template = {
  create: async (data) => {
    const now = new Date().toISOString();
    const ref = col().doc();
    // Never store imageBase64 — only store the Cloudinary URL
    const { imageBase64, ...cleanData } = data;
    const doc = { ...cleanData, createdAt: now, updatedAt: now };
    await ref.set(doc);
    return { _id: ref.id, ...doc };
  },

  findById: async (id) => {
    if (!id || typeof id !== 'string' || id.trim() === '' || id === '[object Object]') return null;
    try {
      const doc = await col().doc(String(id)).get();
      if (!doc.exists) return null;
      return { _id: doc.id, ...doc.data() };
    } catch (err) {
      return null;
    }
  },

  find: async (filter = {}) => {
    let query = col();
    if (filter.createdBy) query = query.where('createdBy', '==', filter.createdBy);
    const snap = await query.get();
    return snap.docs.map(d => ({ _id: d.id, ...d.data() }));
  },

  findOneAndUpdate: async (filter, update, opts = {}) => {
    const id = filter._id || filter.templateId;
    if (!id || typeof id !== 'string' || id.trim() === '') {
      throw new Error('Invalid template ID for update');
    }
    const ref = col().doc(String(id));
    const existing = await ref.get();

    const data = update.$set || update;
    const { imageBase64, ...cleanData } = data;
    const now = new Date().toISOString();

    if (!existing.exists) {
      const doc = { ...cleanData, createdAt: now, updatedAt: now };
      await ref.set(doc);
      return { _id: ref.id, ...doc };
    } else {
      await ref.update({ ...cleanData, updatedAt: now });
      const updated = await ref.get();
      return { _id: updated.id, ...updated.data() };
    }
  },

  deleteOne: async (id) => {
    if (!id) return;
    await col().doc(String(id)).delete();
  }
};

module.exports = Template;
