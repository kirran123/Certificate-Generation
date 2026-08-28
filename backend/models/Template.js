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
  if (!tmpls || !Array.isArray(tmpls) || tmpls.length === 0) return;
  try {
    const dir = path.dirname(backupFilePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    let existing = loadLocalTemplates();
    if (!Array.isArray(existing)) existing = [];
    const map = new Map(existing.map(t => [t._id || t.id, t]));
    for (const t of tmpls) {
      if (t && (t._id || t.id)) {
        const key = t._id || t.id;
        map.set(key, { ...map.get(key), ...t });
      }
    }
    fs.writeFileSync(backupFilePath, JSON.stringify(Array.from(map.values()), null, 2));
  } catch (e) {}
}

let tmplMemoryCache = null;
let tmplCacheTimestamp = 0;
const TMPL_CACHE_TTL = 60000; // 60 seconds

function invalidateTemplateCache() {
  tmplMemoryCache = null;
  tmplCacheTimestamp = 0;
}

async function getAllTemplatesCached() {
  const now = Date.now();
  if (tmplMemoryCache && (now - tmplCacheTimestamp < TMPL_CACHE_TTL)) {
    return tmplMemoryCache;
  }
  try {
    const snap = await col().get();
    tmplMemoryCache = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
    tmplCacheTimestamp = Date.now();
    saveLocalTemplates(tmplMemoryCache);
    return tmplMemoryCache;
  } catch (err) {
    tmplMemoryCache = loadLocalTemplates();
    tmplCacheTimestamp = Date.now();
    return tmplMemoryCache;
  }
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
    invalidateTemplateCache();
    return newTmpl;
  },

  findById: async (id) => {
    if (!id) return null;
    let sid = id;
    if (typeof id === 'object') {
      if (id.imageUrl) return id;
      sid = id._id || id.id || id.templateId || '';
    }
    const all = await getAllTemplatesCached();
    if (!sid || typeof sid !== 'string' || sid.trim() === '' || sid === '[object Object]') {
      return all[all.length - 1] || all[0] || null;
    }
    sid = String(sid).trim();

    const found = all.find(t => String(t._id || t.id) === sid);
    if (found) return found;

    if (all.length > 0) {
      return all[all.length - 1] || all[0];
    }
    return null;
  },

  find: async (filter = {}) => {
    const all = await getAllTemplatesCached();
    if (filter.createdBy) return all.filter(t => String(t.createdBy) === String(filter.createdBy));
    return all;
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
    invalidateTemplateCache();
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
    invalidateTemplateCache();
  }
};

module.exports = Template;
