/**
 * Firestore FormAutomation helper — replaces Mongoose FormAutomation model.
 */
const { getDb } = require('../config/firebase');
const fs = require('fs');
const path = require('path');

const backupFilePath = path.join(__dirname, '..', 'data', 'automations_backup.json');

function loadLocalAutomations() {
  try {
    if (fs.existsSync(backupFilePath)) {
      return JSON.parse(fs.readFileSync(backupFilePath, 'utf8'));
    }
  } catch (e) {}
  return [];
}

function saveLocalAutomations(autos) {
  try {
    const dir = path.dirname(backupFilePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(backupFilePath, JSON.stringify(autos, null, 2));
  } catch (e) {}
}

const col = () => getDb().collection('formAutomations');

let autosMemoryCache = null;
let autosCacheTimestamp = 0;

const FormAutomation = {
  create: async (data) => {
    const now = new Date().toISOString();
    const id = 'auto_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
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

    try {
      await col().doc(id).set(doc);
    } catch (err) {}

    const local = loadLocalAutomations();
    const newAuto = { _id: id, ...doc };
    local.push(newAuto);
    saveLocalAutomations(local);
    autosMemoryCache = local;
    autosCacheTimestamp = Date.now();
    return newAuto;
  },

  find: async (filter = {}) => {
    const now = Date.now();
    let autos = [];
    if (autosMemoryCache && (now - autosCacheTimestamp < 60000)) {
      autos = autosMemoryCache;
    } else {
      try {
        const snap = await col().get();
        autos = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
        saveLocalAutomations(autos);
        autosMemoryCache = autos;
        autosCacheTimestamp = Date.now();
      } catch (err) {
        autos = loadLocalAutomations();
        autosMemoryCache = autos;
        autosCacheTimestamp = Date.now();
      }
    }

    let result = autos;
    if (filter.active !== undefined) result = result.filter(a => a.active === filter.active);
    if (filter.userId) result = result.filter(a => String(a.userId) === String(filter.userId));
    return result;
  },

  findAndPopulate: async (filter = {}) => {
    try {
      const Template = require('./Template');
      const automations = await FormAutomation.find(filter);
      return Promise.all(automations.map(async (auto) => {
        const tmpl = await Template.findById(auto.templateId);
        return { ...auto, templateId: tmpl || auto.templateId };
      }));
    } catch (err) {
      console.warn('[FormAutomation.findAndPopulate] Error:', err.message);
      return [];
    }
  },

  findById: async (id) => {
    if (!id || typeof id !== 'string' || id.trim() === '' || id === '[object Object]') return null;
    const sid = String(id).trim();
    try {
      const doc = await col().doc(sid).get();
      if (doc.exists) return { _id: doc.id, ...doc.data() };
    } catch (err) {}

    const local = loadLocalAutomations();
    return local.find(a => a._id === sid) || null;
  },

  findByIdAndUpdate: async (id, update) => {
    if (!id || typeof id !== 'string' || id.trim() === '') return null;
    const sid = String(id).trim();

    const data = update.$inc ? {} : (update.$set || update);
    const updateData = { ...data, updatedAt: new Date().toISOString() };

    try {
      const ref = col().doc(sid);
      if (update.$inc) {
        const admin = require('firebase-admin');
        const incrementData = {};
        for (const [key, val] of Object.entries(update.$inc)) {
          incrementData[key] = admin.firestore.FieldValue.increment(val);
        }
        await ref.update({ ...updateData, ...incrementData });
      } else {
        await ref.update(updateData);
      }
    } catch (err) {}

    const local = loadLocalAutomations();
    const idx = local.findIndex(a => a._id === sid);
    if (idx !== -1) {
      if (update.$inc) {
        for (const [key, val] of Object.entries(update.$inc)) {
          local[idx][key] = (local[idx][key] || 0) + val;
        }
      } else {
        Object.assign(local[idx], updateData);
      }
      saveLocalAutomations(local);
      return local[idx];
    }
    return null;
  },

  deleteMany: async (filter = {}) => {
    try {
      let query = col();
      if (filter.batchId) query = query.where('batchId', '==', filter.batchId);
      if (filter.userId) query = query.where('userId', '==', String(filter.userId));
      if (filter.active !== undefined) query = query.where('active', '==', filter.active);
      const snap = await query.get();
      const batch = getDb().batch();
      for (const doc of snap.docs) batch.delete(doc.ref);
      await batch.commit();
    } catch (err) {}

    const local = loadLocalAutomations();
    const filtered = local.filter(a => {
      if (filter.batchId && a.batchId === filter.batchId) return false;
      if (filter.userId && String(a.userId) === String(filter.userId)) return false;
      if (filter.active !== undefined && a.active === filter.active) return false;
      return true;
    });
    saveLocalAutomations(filtered);
    return { deletedCount: local.length - filtered.length };
  },

  deleteOne: async (id) => {
    if (!id) return;
    try {
      await col().doc(String(id)).delete();
    } catch (err) {}
    const local = loadLocalAutomations();
    const filtered = local.filter(a => a._id !== String(id));
    saveLocalAutomations(filtered);
  },
};

module.exports = FormAutomation;
