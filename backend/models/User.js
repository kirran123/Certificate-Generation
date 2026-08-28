/**
 * Firestore User helper with local file fallback — protects against Firestore Quota Exceeded errors.
 */
const { getDb } = require('../config/firebase');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

const backupFilePath = path.join(__dirname, '..', 'data', 'users_backup.json');

function loadLocalUsers() {
  try {
    if (fs.existsSync(backupFilePath)) {
      const data = fs.readFileSync(backupFilePath, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Failed to read local users backup:', err.message);
  }
  return [];
}

function saveLocalUsers(users) {
  if (!users || !Array.isArray(users) || users.length === 0) return;
  try {
    const dir = path.dirname(backupFilePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    let existing = loadLocalUsers();
    if (!Array.isArray(existing)) existing = [];
    const map = new Map(existing.map(u => [u._id || u.id, u]));
    for (const u of users) {
      if (u && (u._id || u.id)) {
        const key = u._id || u.id;
        map.set(key, { ...map.get(key), ...u });
      }
    }
    fs.writeFileSync(backupFilePath, JSON.stringify(Array.from(map.values()), null, 2));
  } catch (err) {
    console.error('Failed to save local users backup:', err.message);
  }
}

const col = () => getDb().collection('users');

const User = {
  // Create a new user (auto-hashes password)
  create: async ({ name, email, password, role = 'user' }) => {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const now = new Date().toISOString();
    const id = 'usr_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    const data = { name, email: email.toLowerCase().trim(), passwordHash, role, createdAt: now, updatedAt: now };

    try {
      const ref = col().doc(id);
      await ref.set(data);
    } catch (err) {
      console.warn('[User.create] Firestore quota exceeded/error. Storing locally:', err.message);
    }

    const local = loadLocalUsers();
    const newUser = { _id: id, ...data };
    local.push(newUser);
    saveLocalUsers(local);
    return newUser;
  },

  // Find by email
  findOne: async ({ email }) => {
    const normalizedEmail = email?.toLowerCase().trim();
    try {
      const snap = await col().where('email', '==', normalizedEmail).limit(1).get();
      if (!snap.empty) {
        const doc = snap.docs[0];
        return { _id: doc.id, ...doc.data() };
      }
    } catch (err) {
      console.warn('[User.findOne] Firestore quota exceeded/error. Falling back to local backup:', err.message);
    }

    const local = loadLocalUsers();
    const found = local.find(u => u.email?.toLowerCase().trim() === normalizedEmail);
    return found || null;
  },

  // Find by ID
  findById: async (id) => {
    if (!id) return null;
    try {
      const doc = await col().doc(String(id)).get();
      if (doc.exists) return { _id: doc.id, ...doc.data() };
    } catch (err) {
      console.warn('[User.findById] Firestore quota exceeded/error. Falling back to local backup:', err.message);
    }

    const local = loadLocalUsers();
    const found = local.find(u => u._id === String(id));
    return found || null;
  },

  // Get all users (excluding passwordHash)
  find: async (filter = {}) => {
    try {
      const snap = await col().get();
      const users = snap.docs.map(d => {
        const { passwordHash, ...rest } = d.data();
        return { _id: d.id, ...rest };
      });
      // Save snapshot locally
      saveLocalUsers(snap.docs.map(d => ({ _id: d.id, ...d.data() })));
      return users;
    } catch (err) {
      console.warn('[User.find] Firestore quota exceeded/error. Falling back to local backup:', err.message);
      const local = loadLocalUsers();
      return local.map(({ passwordHash, ...rest }) => rest);
    }
  },

  // Update a user by ID
  findByIdAndUpdate: async (id, updates) => {
    const now = new Date().toISOString();
    try {
      const ref = col().doc(String(id));
      await ref.update({ ...updates, updatedAt: now });
    } catch (err) {
      console.warn('[User.findByIdAndUpdate] Firestore quota exceeded/error:', err.message);
    }

    const local = loadLocalUsers();
    const idx = local.findIndex(u => u._id === String(id));
    if (idx !== -1) {
      local[idx] = { ...local[idx], ...updates, updatedAt: now };
      saveLocalUsers(local);
      return local[idx];
    }
    return null;
  },

  // Update many
  updateMany: async (filter, update) => {
    try {
      let query = col();
      if (filter.role) query = query.where('role', '==', filter.role);
      const snap = await query.get();
      if (!snap.empty) {
        const batch = getDb().batch();
        for (const doc of snap.docs) {
          if (filter.email && filter.email.$ne && doc.data().email === filter.email.$ne) continue;
          if (update.$set) batch.update(doc.ref, { ...update.$set, updatedAt: new Date().toISOString() });
        }
        await batch.commit();
      }
    } catch (err) {
      console.warn('[User.updateMany] Firestore error:', err.message);
    }

    const local = loadLocalUsers();
    let count = 0;
    local.forEach(u => {
      if (filter.role && u.role !== filter.role) return;
      if (filter.email && filter.email.$ne && u.email === filter.email.$ne) return;
      if (update.$set) {
        Object.assign(u, update.$set);
        count++;
      }
    });
    saveLocalUsers(local);
    return { modifiedCount: count };
  },

  // Delete a user by ID
  deleteOne: async (id) => {
    try {
      await col().doc(String(id)).delete();
    } catch (err) {
      console.warn('[User.deleteOne] Firestore error:', err.message);
    }
    const local = loadLocalUsers();
    const filtered = local.filter(u => u._id !== String(id));
    saveLocalUsers(filtered);
    return { deletedCount: 1 };
  },

  // Count all users
  countDocuments: async () => {
    try {
      const snap = await col().get();
      return snap.size;
    } catch (err) {
      const local = loadLocalUsers();
      return local.length;
    }
  },

  // Compare a plain password against stored hash
  comparePassword: async (user, candidatePassword) => {
    if (!user || !user.passwordHash) return false;
    return bcrypt.compare(candidatePassword, user.passwordHash);
  },

  // Save updated user doc
  save: async (user) => {
    const { _id, ...data } = user;
    try {
      await col().doc(String(_id)).set({ ...data, updatedAt: new Date().toISOString() }, { merge: true });
    } catch (err) {
      console.warn('[User.save] Firestore error:', err.message);
    }
    const local = loadLocalUsers();
    const idx = local.findIndex(u => u._id === String(_id));
    if (idx !== -1) {
      local[idx] = { _id, ...data };
    } else {
      local.push({ _id, ...data });
    }
    saveLocalUsers(local);
    return user;
  },
};

module.exports = User;
