/**
 * Firestore FormAutomation helper — replaces Mongoose FormAutomation model.
 */
const { getDb } = require('../config/firebase');

const col = () => getDb().collection('formAutomations');

const FormAutomation = {
  create: async (data) => {
    const now = new Date().toISOString();
    const ref = col().doc();
    const doc = {
      ...data,
      userId: String(data.userId),
      templateId: String(data.templateId),
      active: data.active !== undefined ? data.active : true,
      certCount: data.certCount || 0,
      lastChecked: null,
      createdAt: now,
      updatedAt: now,
    };
    await ref.set(doc);
    return { _id: ref.id, ...doc };
  },

  find: async (filter = {}) => {
    let query = col();
    if (filter.active !== undefined) query = query.where('active', '==', filter.active);
    if (filter.userId) query = query.where('userId', '==', String(filter.userId));
    const snap = await query.get();
    return snap.docs.map(d => ({ _id: d.id, ...d.data() }));
  },

  // Find with populate (attach template object)
  findAndPopulate: async (filter = {}) => {
    const Template = require('./Template');
    const automations = await FormAutomation.find(filter);
    return Promise.all(automations.map(async (auto) => {
      const tmpl = await Template.findById(auto.templateId);
      return { ...auto, templateId: tmpl || auto.templateId };
    }));
  },

  findById: async (id) => {
    const doc = await col().doc(id).get();
    if (!doc.exists) return null;
    return { _id: doc.id, ...doc.data() };
  },

  findByIdAndUpdate: async (id, update) => {
    const ref = col().doc(id);
    const data = update.$inc
      ? {} // handle below
      : (update.$set || update);

    const updateData = { ...data, updatedAt: new Date().toISOString() };

    if (update.$inc) {
      // Use Firestore increment
      const admin = require('firebase-admin');
      const incrementData = {};
      for (const [key, val] of Object.entries(update.$inc)) {
        incrementData[key] = admin.firestore.FieldValue.increment(val);
      }
      await ref.update({ ...updateData, ...incrementData });
    } else {
      await ref.update(updateData);
    }

    const doc = await ref.get();
    return { _id: doc.id, ...doc.data() };
  },

  deleteMany: async (filter = {}) => {
    let query = col();
    if (filter.batchId) query = query.where('batchId', '==', filter.batchId);
    if (filter.userId) query = query.where('userId', '==', String(filter.userId));
    if (filter.active !== undefined) query = query.where('active', '==', filter.active);
    const snap = await query.get();
    const batch = getDb().batch();
    for (const doc of snap.docs) batch.delete(doc.ref);
    await batch.commit();
    return { deletedCount: snap.size };
  },

  deleteOne: async (id) => {
    await col().doc(String(id)).delete();
  },
};

module.exports = FormAutomation;
