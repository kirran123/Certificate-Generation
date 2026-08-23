/**
 * Firestore Certificate helper — replaces Mongoose Certificate model.
 */
const { getDb } = require('../config/firebase');

const col = () => getDb().collection('certificates');

const Certificate = {
  create: async (data) => {
    const now = new Date().toISOString();
    const ref = col().doc();
    const doc = {
      ...data,
      createdBy: String(data.createdBy),
      templateId: String(data.templateId),
      isArchived: data.isArchived || false,
      createdAt: now,
      updatedAt: now,
    };
    await ref.set(doc);
    return { _id: ref.id, ...doc };
  },

  findOne: async (filter) => {
    let query = col();
    if (filter.certificateId) query = query.where('certificateId', '==', filter.certificateId);
    if (filter.uniqueHash) query = query.where('uniqueHash', '==', filter.uniqueHash);
    if (filter.templateId) query = query.where('templateId', '==', String(filter.templateId));
    query = query.limit(1);
    const snap = await query.get();
    if (snap.empty) return null;
    const doc = snap.docs[0];
    return { _id: doc.id, ...doc.data() };
  },

  findById: async (id) => {
    if (!id) return null;
    const doc = await col().doc(String(id)).get();
    if (!doc.exists) return null;
    return { _id: doc.id, ...doc.data() };
  },

  findByDocId: async (id) => {
    if (!id) return null;
    const doc = await col().doc(String(id)).get();
    if (!doc.exists) return null;
    return { _id: doc.id, ...doc.data() };
  },

  find: async (filter = {}) => {
    let query = col();
    if (filter.createdBy) query = query.where('createdBy', '==', String(filter.createdBy));
    if (filter.batchId) query = query.where('batchId', '==', filter.batchId);
    if (filter.status) query = query.where('status', '==', filter.status);
    if (filter.certificateId && filter.certificateId.$in) {
      const ids = filter.certificateId.$in;
      const results = [];
      for (let i = 0; i < ids.length; i += 10) {
        const chunk = ids.slice(i, i + 10);
        const snap = await col().where('certificateId', 'in', chunk).get();
        snap.docs.forEach(d => results.push({ _id: d.id, ...d.data() }));
      }
      return results;
    }
    const snap = await query.get();
    let certs = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
    if (filter.isArchived !== undefined) {
      if (filter.isArchived && filter.isArchived.$ne !== undefined) {
        certs = certs.filter(c => c.isArchived !== filter.isArchived.$ne);
      } else {
        certs = certs.filter(c => c.isArchived === filter.isArchived);
      }
    }
    return certs;
  },

  populate: async (certs, field = 'templateId') => {
    const Template = require('./Template');
    return Promise.all(certs.map(async (cert) => {
      if (field === 'templateId' && cert.templateId) {
        const tmpl = await Template.findById(cert.templateId);
        return { ...cert, templateId: tmpl || cert.templateId };
      }
      return cert;
    }));
  },

  updateOne: async (filter, update) => {
    let query = col();
    if (filter.certificateId) query = query.where('certificateId', '==', filter.certificateId);
    if (filter.createdBy) query = query.where('createdBy', '==', String(filter.createdBy));
    const snap = await query.limit(1).get();
    if (snap.empty) return { modifiedCount: 0 };
    const ref = snap.docs[0].ref;
    const data = update.$set || update;
    await ref.update({ ...data, updatedAt: new Date().toISOString() });
    return { modifiedCount: 1 };
  },

  updateMany: async (filter, update) => {
    let query = col();
    if (filter.batchId) query = query.where('batchId', '==', filter.batchId);
    if (filter.createdBy) query = query.where('createdBy', '==', String(filter.createdBy));
    const snap = await query.get();
    if (snap.empty) return { modifiedCount: 0 };

    const batch = getDb().batch();
    const data = update.$set || update;
    for (const doc of snap.docs) {
      batch.update(doc.ref, { ...data, updatedAt: new Date().toISOString() });
    }
    await batch.commit();
    return { modifiedCount: snap.size };
  },

  deleteOne: async (filter) => {
    let query = col();
    if (filter.certificateId) query = query.where('certificateId', '==', filter.certificateId);
    if (filter.createdBy) query = query.where('createdBy', '==', String(filter.createdBy));
    const snap = await query.limit(1).get();
    if (!snap.empty) await snap.docs[0].ref.delete();
  },

  countDocuments: async (filter = {}) => {
    const certs = await Certificate.find(filter);
    return certs.length;
  },

  save: async (cert) => {
    const { _id, ...data } = cert;
    await col().doc(String(_id)).update({ ...data, updatedAt: new Date().toISOString() });
    return cert;
  },
};

module.exports = Certificate;
