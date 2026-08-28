/**
 * Firestore Template helper with local backup fallback.
 */
const { getDb } = require('../config/firebase');
const fs = require('fs');
const path = require('path');

const backupFilePath = path.join(__dirname, '..', 'data', 'templates_backup.json');

function loadLocalTemplates() {
  try {
    if (fs.existsSync(backupFilePath)) {
      return JSON.parse(fs.readFileSync(backupFilePath, 'utf8'));
    }
  } catch (e) {}
  return [];
}

function saveLocalTemplates(tmpls) {
  try {
    const dir = path.dirname(backupFilePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(backupFilePath, JSON.stringify(tmpls, null, 2));
  } catch (e) {}
}

const col = () => getDb().collection('templates');

const Template = {
  create: async (data) => {
    const now = new Date().toISOString();
    const id = 'tmpl_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    const { imageBase64, ...cleanData } = data;
    const doc = { ...cleanData, createdAt: now, updatedAt: now };

    try {
      await col().doc(id).set(doc);
    } catch (err) {
      console.warn('[Template.create] Firestore error:', err.message);
    }

    const local = loadLocalTemplates();
    const newTmpl = { _id: id, ...doc };
    local.push(newTmpl);
    saveLocalTemplates(local);
    return newTmpl;
  },

  findById: async (id) => {
    if (!id) return null;
    let sid = id;
    if (typeof id === 'object') {
      if (id.imageUrl) return id;
      sid = id._id || id.id || id.templateId || '';
    }
    if (!sid || typeof sid !== 'string' || sid.trim() === '' || sid === '[object Object]') {
      const local = loadLocalTemplates();
      return local[local.length - 1] || local[0] || null;
    }
    sid = String(sid).trim();

    try {
      const doc = await col().doc(sid).get();
      if (doc.exists) return { _id: doc.id, ...doc.data() };
    } catch (err) {
      // Fallback
    }

    const local = loadLocalTemplates();
    const found = local.find(t => t._id === sid || t.id === sid);
    if (found) return found;

    // Fallback if legacy template ID is not found
    if (local.length > 0) {
      return local[local.length - 1] || local[0];
    }
    return null;
  },

  find: async (filter = {}) => {
    try {
      let query = col();
      if (filter.createdBy) query = query.where('createdBy', '==', filter.createdBy);
      const snap = await query.get();
      const tmpls = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
      saveLocalTemplates(tmpls);
      return tmpls;
    } catch (err) {
      console.warn('[Template.find] Firestore error. Falling back to local:', err.message);
      const local = loadLocalTemplates();
      if (filter.createdBy) return local.filter(t => t.createdBy === filter.createdBy);
      return local;
    }
  },

  findOneAndUpdate: async (filter, update) => {
    const id = filter._id || filter.templateId;
    if (!id) return null;
    const sid = String(id);
    const data = update.$set || update;
    const { imageBase64, ...cleanData } = data;
    const now = new Date().toISOString();

    try {
      const ref = col().doc(sid);
      const existing = await ref.get();
      if (!existing.exists) {
        await ref.set({ ...cleanData, createdAt: now, updatedAt: now });
      } else {
        await ref.update({ ...cleanData, updatedAt: now });
      }
    } catch (err) {
      console.warn('[Template.findOneAndUpdate] Firestore error:', err.message);
    }

    const local = loadLocalTemplates();
    const idx = local.findIndex(t => t._id === sid);
    if (idx !== -1) {
      local[idx] = { ...local[idx], ...cleanData, updatedAt: now };
    } else {
      local.push({ _id: sid, ...cleanData, createdAt: now, updatedAt: now });
    }
    saveLocalTemplates(local);
    return local.find(t => t._id === sid);
  },

  deleteOne: async (id) => {
    if (!id) return;
    try {
      await col().doc(String(id)).delete();
    } catch (err) {}
    const local = loadLocalTemplates();
    const filtered = local.filter(t => t._id !== String(id));
    saveLocalTemplates(filtered);
  }
};

module.exports = Template;
