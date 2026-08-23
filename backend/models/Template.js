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
    const doc = await col().doc(id).get();
    if (!doc.exists) return null;
    return { _id: doc.id, ...doc.data() };
  },

  find: async (filter = {}) => {
    let query = col();
    if (filter.createdBy) query = query.where('createdBy', '==', filter.createdBy);
    const snap = await query.get();
    return snap.docs.map(d => ({ _id: d.id, ...d.data() }));
  },

  findOneAndUpdate: async (filter, update, opts = {}) => {
    const { templateId, createdBy } = filter._id
      ? { templateId: filter._id, createdBy: filter.createdBy }
      : { templateId: filter._id, createdBy: filter.createdBy };

    const id = filter._id || filter.templateId;
    const ref = col().doc(String(id));
    const existing = await ref.get();
    const { imageBase64, ...cleanUpdate } = update.$set || update;
    const now = new Date().toISOString();

    if (!existing.exists && opts.upsert) {
      await ref.set({ ...cleanUpdate, createdAt: now, updatedAt: now });
    } else {
      await ref.update({ ...cleanUpdate, updatedAt: now });
    }
    const doc = await ref.get();
    return { _id: doc.id, ...doc.data() };
  },

  deleteOne: async (id) => {
    await col().doc(String(id)).delete();
  },
};

module.exports = Template;
