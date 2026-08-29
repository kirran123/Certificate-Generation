/**
 * Firestore Certificate helper with local backup fallback.
 */
const { getDb } = require('../config/firebase');
const fs = require('fs');
const path = require('path');

const backupFilePath = path.join(__dirname, '..', 'data', 'certificates_backup.json');

function loadLocalCertificates() {
  try {
    if (fs.existsSync(backupFilePath)) {
      return JSON.parse(fs.readFileSync(backupFilePath, 'utf8'));
    }
  } catch (e) {}
  return [];
}

function saveLocalCertificates(certs) {
  if (!certs || !Array.isArray(certs) || certs.length === 0) return;
  try {
    const dir = path.dirname(backupFilePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    let existing = loadLocalCertificates();
    if (!Array.isArray(existing)) existing = [];

    const map = new Map(existing.map(c => [c._id || c.certificateId, c]));
    for (const c of certs) {
      if (c && (c._id || c.certificateId)) {
        const key = c._id || c.certificateId;
        map.set(key, { ...map.get(key), ...c });
      }
    }
    const merged = Array.from(map.values());
    fs.writeFileSync(backupFilePath, JSON.stringify(merged, null, 2));
  } catch (e) {}
}

const { markEmailSent } = require('../utils/sentLock');

let certsMemoryCache = null;

function invalidateCertificateCache() {
  certsMemoryCache = null;
}

async function getAllCertificatesCached() {
  if (certsMemoryCache && certsMemoryCache.length > 0) {
    return certsMemoryCache;
  }
  certsMemoryCache = loadLocalCertificates();
  return certsMemoryCache;
}

const col = () => getDb().collection('certificates');

const Certificate = {
  create: async (data) => {
    const now = new Date().toISOString();
    const id = 'cert_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    const doc = {
      ...data,
      createdBy: String(data.createdBy || ''),
      templateId: typeof data.templateId === 'object' ? String(data.templateId._id || '') : String(data.templateId || ''),
      isArchived: data.isArchived || false,
      createdAt: now,
      updatedAt: now,
    };

    try {
      await col().doc(id).set(doc);
    } catch (err) {
      console.warn('[Certificate.create] Firestore write notice:', err.message);
    }

    const newCert = { _id: id, ...doc };
    const local = loadLocalCertificates();
    local.push(newCert);
    saveLocalCertificates([newCert]);

    if (!certsMemoryCache) certsMemoryCache = local;
    else certsMemoryCache.push(newCert);

    // Sync to anti-duplicate sentLock
    if (newCert.certificateId) markEmailSent(newCert.certificateId);
    if (newCert.uniqueHash) markEmailSent(newCert.uniqueHash);
    if (newCert.email && newCert.templateId) {
      const emailNorm = String(newCert.email).trim().toLowerCase();
      const tmplId = String(newCert.templateId._id || newCert.templateId).trim().toLowerCase();
      const baseBatch = String(newCert.batchId || '').replace(/\s*\[Run \d{2}:\d{2}\]/, '').trim().toLowerCase();
      markEmailSent([`${tmplId}_${emailNorm}_${baseBatch}`, `${tmplId}_${emailNorm}`]);
    }

    return newCert;
  },

  findOne: async (filter) => {
    const all = await getAllCertificatesCached();
    if (filter.certificateId) {
      const match = all.find(c => c.certificateId === filter.certificateId);
      if (match) return match;
      try {
        const snap = await col().where('certificateId', '==', filter.certificateId).limit(1).get();
        if (!snap.empty) {
          const doc = { _id: snap.docs[0].id, ...snap.docs[0].data() };
          if (certsMemoryCache) certsMemoryCache.push(doc);
          saveLocalCertificates([doc]);
          return doc;
        }
      } catch (e) {}
      return null;
    }
    if (filter.uniqueHash) {
      const match = all.find(c => c.uniqueHash === filter.uniqueHash);
      if (match) return match;
      try {
        const snap = await col().where('uniqueHash', '==', filter.uniqueHash).limit(1).get();
        if (!snap.empty) {
          const doc = { _id: snap.docs[0].id, ...snap.docs[0].data() };
          if (certsMemoryCache) certsMemoryCache.push(doc);
          saveLocalCertificates([doc]);
          return doc;
        }
      } catch (e) {}
      return null;
    }
    if (filter.templateId && filter.email) {
      const normEmail = String(filter.email).trim().toLowerCase();
      const tmplId = String(filter.templateId._id || filter.templateId);
      const match = all.find(c => String(c.templateId._id || c.templateId) === tmplId && String(c.email || '').trim().toLowerCase() === normEmail);
      if (match) return match;
      return null;
    }
    if (filter.templateId) {
      const tmplId = String(filter.templateId._id || filter.templateId);
      return all.find(c => String(c.templateId._id || c.templateId) === tmplId) || null;
    }
    return null;
  },

  findById: async (id) => {
    if (!id || typeof id !== 'string' || id.trim() === '' || id === '[object Object]') return null;
    const sid = String(id).trim();
    const all = await getAllCertificatesCached();
    return all.find(c => String(c._id) === sid || String(c.certificateId) === sid) || null;
  },

  findByDocId: async (id) => {
    if (!id || typeof id !== 'string' || id.trim() === '' || id === '[object Object]') return null;
    const sid = String(id).trim();
    const all = await getAllCertificatesCached();
    return all.find(c => String(c._id) === sid || String(c.certificateId) === sid) || null;
  },

  find: async (filter = {}) => {
    let certs = await getAllCertificatesCached();

    if (filter.createdBy) certs = certs.filter(c => String(c.createdBy?._id || c.createdBy || '') === String(filter.createdBy));
    if (filter.batchId) certs = certs.filter(c => c.batchId === filter.batchId);
    if (filter.status) certs = certs.filter(c => c.status === filter.status);

    if (filter.isArchived !== undefined) {
      if (filter.isArchived && filter.isArchived.$ne !== undefined) {
        certs = certs.filter(c => c.isArchived !== filter.isArchived.$ne);
      } else {
        certs = certs.filter(c => c.isArchived === filter.isArchived);
      }
    }
    return certs;
  },

  populate: async (certs, fields = 'templateId createdBy') => {
    if (!certs || certs.length === 0) return [];
    const Template = require('./Template');
    const User = require('./User');

    let tmplMap = new Map();
    let userMap = new Map();
    let allTemplates = [];
    const fieldsStr = String(fields);

    try {
      if (fieldsStr.includes('templateId')) {
        allTemplates = await Template.find({});
        tmplMap = new Map(allTemplates.map(t => [String(t._id), t]));
      }
      if (fieldsStr.includes('createdBy')) {
        const allUsers = await User.find({});
        userMap = new Map(allUsers.map(u => [String(u._id), u]));
      }
    } catch (err) {
      console.warn('[Certificate.populate] Error loading references:', err.message);
    }

    return certs.map((cert) => {
      let updatedCert = { ...cert };

      if (fieldsStr.includes('templateId') && updatedCert.templateId) {
        const rawTid = typeof updatedCert.templateId === 'object' ? (updatedCert.templateId._id || updatedCert.templateId.id) : updatedCert.templateId;
        const tid = String(rawTid || '').trim();
        if (tid && tid !== '[object Object]') {
          const tmpl = tmplMap.get(tid) || (allTemplates.length > 0 ? (allTemplates[allTemplates.length - 1] || allTemplates[0]) : null);
          if (tmpl) updatedCert.templateId = tmpl;
        }
      }

      if (fieldsStr.includes('createdBy') && updatedCert.createdBy) {
        const rawUid = typeof updatedCert.createdBy === 'object' ? (updatedCert.createdBy._id || updatedCert.createdBy.id) : updatedCert.createdBy;
        const uid = String(rawUid || '').trim();
        if (uid && uid !== '[object Object]') {
          const usr = userMap.get(uid);
          if (usr) {
            const { passwordHash, ...safeUser } = usr;
            updatedCert.createdBy = safeUser;
          }
        }
      }

      return updatedCert;
    });
  },

  save: async (cert) => {
    if (!cert) return cert;
    const certId = cert.certificateId;
    const id = cert._id;
    const now = new Date().toISOString();

    const templateId = typeof cert.templateId === 'object' ? String(cert.templateId._id || cert.templateId.id || '') : String(cert.templateId || '');
    const createdBy = typeof cert.createdBy === 'object' ? String(cert.createdBy._id || cert.createdBy.id || '') : String(cert.createdBy || '');

    const dataToSave = {
      ...cert,
      templateId,
      createdBy,
      updatedAt: now,
    };

    try {
      if (id) {
        await col().doc(String(id)).set(dataToSave, { merge: true });
      } else if (certId) {
        const snap = await col().where('certificateId', '==', certId).limit(1).get();
        if (!snap.empty) {
          await snap.docs[0].ref.set(dataToSave, { merge: true });
        }
      }
    } catch (err) {
      console.warn('[Certificate.save] Firestore error:', err.message);
    }

    const local = loadLocalCertificates();
    const idx = local.findIndex(c => (id && c._id === String(id)) || (certId && c.certificateId === certId));
    if (idx !== -1) {
      local[idx] = { ...local[idx], ...dataToSave };
    } else {
      local.push(dataToSave);
    }
    saveLocalCertificates(local);

    if (certsMemoryCache && Array.isArray(certsMemoryCache)) {
      const cacheIdx = certsMemoryCache.findIndex(c => (id && c._id === String(id)) || (certId && c.certificateId === certId));
      if (cacheIdx !== -1) {
        certsMemoryCache[cacheIdx] = { ...certsMemoryCache[cacheIdx], ...dataToSave };
      } else {
        certsMemoryCache.push(dataToSave);
      }
    } else {
      certsMemoryCache = local;
      certsCacheTimestamp = Date.now();
    }
    return cert;
  },

  updateOne: async (filter, update) => {
    const data = update.$set || update;
    try {
      let query = col();
      if (filter.certificateId) query = query.where('certificateId', '==', filter.certificateId);
      if (filter.createdBy) query = query.where('createdBy', '==', String(filter.createdBy));
      const snap = await query.limit(1).get();
      if (!snap.empty) {
        await snap.docs[0].ref.update({ ...data, updatedAt: new Date().toISOString() });
      }
    } catch (err) {}

    const local = loadLocalCertificates();
    const item = local.find(c => (filter.certificateId && c.certificateId === filter.certificateId) || (filter.createdBy && String(c.createdBy) === String(filter.createdBy)));
    if (item) {
      Object.assign(item, data, { updatedAt: new Date().toISOString() });
      saveLocalCertificates(local);
      invalidateCertificateCache();
      return { modifiedCount: 1 };
    }
    invalidateCertificateCache();
    return { modifiedCount: 0 };
  },

  updateMany: async (filter, update) => {
    const data = update.$set || update;
    try {
      let query = col();
      if (filter.batchId) query = query.where('batchId', '==', filter.batchId);
      const snap = await query.get();
      if (!snap.empty) {
        let batch = getDb().batch();
        let counter = 0;
        for (const doc of snap.docs) {
          batch.update(doc.ref, { ...data, updatedAt: new Date().toISOString() });
          counter++;
          if (counter === 450) {
            await batch.commit();
            batch = getDb().batch();
            counter = 0;
          }
        }
        if (counter > 0) await batch.commit();
      }
    } catch (err) {}

    const local = loadLocalCertificates();
    let count = 0;
    local.forEach(c => {
      if (filter.batchId && c.batchId !== filter.batchId) return;
      Object.assign(c, data, { updatedAt: new Date().toISOString() });
      count++;
    });
    saveLocalCertificates(local);
    invalidateCertificateCache();
    return { modifiedCount: count };
  },

  deleteOne: async (filter) => {
    const certId = typeof filter === 'string' ? filter : filter.certificateId;
    try {
      let query = col().where('certificateId', '==', certId);
      const snap = await query.get();
      if (!snap.empty) await snap.docs[0].ref.delete();
    } catch (err) {}

    const local = loadLocalCertificates();
    const filtered = local.filter(c => c.certificateId !== certId);
    saveLocalCertificates(filtered);
    invalidateCertificateCache();
    return { deletedCount: 1 };
  },

  deleteMany: async (filter) => {
    try {
      let query = col();
      if (filter.batchId) query = query.where('batchId', '==', filter.batchId);
      const snap = await query.get();
      if (!snap.empty) {
        let batch = getDb().batch();
        let counter = 0;
        for (const doc of snap.docs) {
          batch.delete(doc.ref);
          counter++;
          if (counter === 450) {
            await batch.commit();
            batch = getDb().batch();
            counter = 0;
          }
        }
        if (counter > 0) await batch.commit();
      }
    } catch (err) {}

    const local = loadLocalCertificates();
    const filtered = local.filter(c => filter.batchId && c.batchId !== filter.batchId);
    saveLocalCertificates(filtered);
    invalidateCertificateCache();
    return { deletedCount: 1 };
  }
};

module.exports = Certificate;
