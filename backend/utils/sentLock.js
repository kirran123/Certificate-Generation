const fs = require('fs');
const path = require('path');

const lockFilePath = path.join(__dirname, '..', 'data', 'sent_emails_lock.json');
let sentSetMemory = null;

function loadSentLock() {
  if (sentSetMemory) return sentSetMemory;
  try {
    if (fs.existsSync(lockFilePath)) {
      const data = JSON.parse(fs.readFileSync(lockFilePath, 'utf8'));
      sentSetMemory = new Set(Array.isArray(data) ? data : []);
      return sentSetMemory;
    }
  } catch (e) {
    console.warn('[SentLock] Error loading lock file:', e.message);
  }
  sentSetMemory = new Set();
  return sentSetMemory;
}

function saveSentLock() {
  try {
    if (!sentSetMemory) return;
    const dir = path.dirname(lockFilePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(lockFilePath, JSON.stringify(Array.from(sentSetMemory), null, 2));
  } catch (e) {
    console.warn('[SentLock] Error saving lock file:', e.message);
  }
}

function isEmailSent(key) {
  if (!key) return false;
  const lock = loadSentLock();
  return lock.has(String(key).toLowerCase().trim());
}

function markEmailSent(keys) {
  const lock = loadSentLock();
  const arr = Array.isArray(keys) ? keys : [keys];
  let updated = false;
  for (const k of arr) {
    if (k) {
      const normKey = String(k).toLowerCase().trim();
      if (!lock.has(normKey)) {
        lock.add(normKey);
        updated = true;
      }
    }
  }
  if (updated) {
    saveSentLock();
  }
}

function seedSentLockFromLocalData() {
  const lock = loadSentLock();

  try {
    const certBackupPath = path.join(__dirname, '..', 'data', 'certificates_backup.json');
    if (fs.existsSync(certBackupPath)) {
      const certs = JSON.parse(fs.readFileSync(certBackupPath, 'utf8'));
      for (const c of certs) {
        if (!c) continue;
        if (c.certificateId) lock.add(String(c.certificateId).toLowerCase().trim());
        if (c.uniqueHash) lock.add(String(c.uniqueHash).toLowerCase().trim());
        if (c.email && c.templateId) {
          const emailNorm = String(c.email).trim().toLowerCase();
          const tmplId = String(c.templateId._id || c.templateId).trim().toLowerCase();
          const batch = String(c.batchId || '').replace(/\s*\[Run \d{2}:\d{2}\]/, '').trim().toLowerCase();
          lock.add(`${tmplId}_${emailNorm}_${batch}`);
          lock.add(`${tmplId}_${emailNorm}`);
        }
      }
    }
  } catch (e) {}

  saveSentLock();
  return lock.size;
}

// Seed on startup
seedSentLockFromLocalData();

module.exports = {
  isEmailSent,
  markEmailSent,
  loadSentLock,
  seedSentLockFromLocalData
};
