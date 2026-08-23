/**
 * Firestore User helper — replaces Mongoose User model.
 * All methods are async and return plain JS objects.
 */
const { getDb } = require('../config/firebase');
const bcrypt = require('bcrypt');

const col = () => getDb().collection('users');

const User = {
  // Create a new user (auto-hashes password)
  create: async ({ name, email, password, role = 'user' }) => {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const now = new Date().toISOString();
    const ref = col().doc();
    const data = { name, email, passwordHash, role, createdAt: now, updatedAt: now };
    await ref.set(data);
    return { _id: ref.id, ...data };
  },

  // Find by email
  findOne: async ({ email }) => {
    const snap = await col().where('email', '==', email).limit(1).get();
    if (snap.empty) return null;
    const doc = snap.docs[0];
    return { _id: doc.id, ...doc.data() };
  },

  // Find by ID
  findById: async (id) => {
    if (!id) return null;
    const doc = await col().doc(String(id)).get();
    if (!doc.exists) return null;
    return { _id: doc.id, ...doc.data() };
  },

  // Get all users (excluding passwordHash)
  find: async (filter = {}) => {
    let query = col();
    const snap = await query.get();
    return snap.docs.map(d => {
      const { passwordHash, ...rest } = d.data();
      return { _id: d.id, ...rest };
    });
  },

  // Update a user by ID
  findByIdAndUpdate: async (id, updates) => {
    const ref = col().doc(String(id));
    await ref.update({ ...updates, updatedAt: new Date().toISOString() });
    const doc = await ref.get();
    return { _id: doc.id, ...doc.data() };
  },

  // Update many (e.g., demote all other admins)
  updateMany: async (filter, update) => {
    let query = col();
    if (filter.role) query = query.where('role', '==', filter.role);

    const snap = await query.get();
    if (snap.empty) return { modifiedCount: 0 };

    const batch = getDb().batch();
    let count = 0;
    for (const doc of snap.docs) {
      const data = doc.data();
      if (filter.email && filter.email.$ne && data.email === filter.email.$ne) continue;
      if (update.$set) {
        batch.update(doc.ref, { ...update.$set, updatedAt: new Date().toISOString() });
        count++;
      }
    }
    if (count > 0) await batch.commit();
    return { modifiedCount: count };
  },

  // Delete a user by ID
  deleteOne: async (id) => {
    await col().doc(String(id)).delete();
  },

  // Count all users
  countDocuments: async () => {
    const snap = await col().get();
    return snap.size;
  },

  // Compare a plain password against stored hash
  comparePassword: async (user, candidatePassword) => {
    return bcrypt.compare(candidatePassword, user.passwordHash);
  },

  // Save updated user doc (used by admin seed logic)
  save: async (user) => {
    const { _id, ...data } = user;
    await col().doc(String(_id)).set({ ...data, updatedAt: new Date().toISOString() }, { merge: true });
    return user;
  },
};

module.exports = User;
