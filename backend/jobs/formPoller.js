/**
 * formPoller.js — Runs every 10 seconds.
 * Checks all active FormAutomation docs in Firestore,
 * fetches their linked Google Sheet, and auto-generates + emails
 * certificates for any new rows not yet processed.
 */

const axios = require('axios');
const xlsx = require('xlsx');

const FormAutomation = require('../models/FormAutomation');
const Template = require('../models/Template');
const Certificate = require('../models/Certificate');
const EmailLog = require('../models/EmailLog');
const { createCertificatePDF, calculateUniqueHash } = require('../utils/pdfGenerator');
const { sendEmailWithFailover } = require('../utils/brevoPool');
const { isEmailSent, markEmailSent } = require('../utils/sentLock');

const POLL_INTERVAL_MS = 60_000; // 60 seconds (reduced read load)
let isPollerExecuting = false;

// ── Generate unique cert ID ──────────────────────────────────────────────────
const generateUniqueId = async () => {
  let certId, isUnique = false;
  while (!isUnique) {
    const r = Math.floor(100000 + Math.random() * 900000).toString();
    certId = `CERT${r}`;
    const existing = await Certificate.findOne({ certificateId: certId });
    if (!existing) isUnique = true;
  }
  return certId;
};

// ── Send certificate email ───────────────────────────────────────────────────
const sendCertEmail = async (cert, template, auto = {}) => {
  const itemData = { name: cert.name, email: cert.email, course: cert.course, certificateId: cert.certificateId, ...(cert.metadata || {}) };
  const pdfBytes = await createCertificatePDF(template, itemData, cert.certificateId);
  const base64Pdf = Buffer.from(pdfBytes).toString('base64');

  const htmlContent = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;border:1px solid #eee;border-radius:10px;">
      <h2 style="color:#4f46e5;">Your Certificate is Ready! 🎉</h2>
      <p>Hi <strong>${cert.name}</strong>,</p>
      <p>${auto.emailMessage || 'Congratulations! Your certificate has been generated and is attached.'}</p>
      <div style="margin:20px 0;padding:15px;background:#f9fafb;border-radius:8px;">
        <p style="margin:0;font-size:12px;color:#6b7280;">Certificate ID:</p>
        <p style="margin:0;font-weight:bold;font-family:monospace;">${cert.certificateId}</p>
      </div>
      <p style="font-size:14px;color:#374151;">Best Regards,<br/><strong>DigiCertify Team</strong></p>
    </div>`;

  await sendEmailWithFailover({
    to: cert.email,
    name: cert.name,
    subject: auto.emailSubject || 'Your Certificate of Achievement',
    htmlContent,
    pdfBase64: base64Pdf,
    certId: cert.certificateId,
    senderName: 'DigiCertify',
    senderEmail: process.env.SMTP_USER || 'digicertify00@gmail.com',
  });
};

function normalizeEmail(rawEmail) {
  if (!rawEmail) return '';
  let email = String(rawEmail).replace(/\s+/g, '');
  email = email.replace(/^[<"'\s]+|[>'"\s]+$/g, '');
  email = email.replace(/[\s.,;:)]+$/g, '');
  email = email.replace(/^[\s.,;:(]+/g, '');
  if (email.includes('@')) {
    const parts = email.split('@');
    const local = parts[0];
    const domain = parts.slice(1).join('@').replace(/\.{2,}/g, '.').replace(/^\.+|\.+$/g, '');
    email = `${local}@${domain}`;
  }
  return email.toLowerCase();
}

// ── Main polling function ────────────────────────────────────────────────────
const pollOnce = async () => {
  if (isPollerExecuting) return;
  isPollerExecuting = true;

  const processedInRun = new Set();

  let automations;
  try {
    // Fetch active automations and populate their template
    automations = await FormAutomation.findAndPopulate({ active: true });
  } catch (e) {
    console.error('[Poll] Firestore error:', e.message);
    isPollerExecuting = false;
    return;
  }

  for (const auto of automations) {
    try {
      const urlsToTry = [
        `https://docs.google.com/spreadsheets/d/${auto.sheetId}/export?format=csv&gid=${auto.gid || 0}`,
        `https://docs.google.com/spreadsheets/d/${auto.sheetId}/export?format=csv`,
        `https://docs.google.com/spreadsheets/d/${auto.sheetId}/gviz/tq?tqx=out:csv`,
      ];

      let rows = null;
      for (const exportUrl of urlsToTry) {
        try {
          const response = await axios.get(exportUrl, { responseType: 'arraybuffer', timeout: 10000, headers: { 'User-Agent': 'Mozilla/5.0' } });
          const text = Buffer.from(response.data).toString('utf8', 0, 200);
          if (text.includes('<html') && (text.includes('accounts.google.com') || text.includes('ServiceLogin'))) continue;
          const workbook = xlsx.read(response.data, { type: 'buffer' });
          rows = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { raw: false, defval: '' });
          if (rows && rows.length > 0) break;
        } catch (e) { /* try next url */ }
      }

      if (!rows || rows.length === 0) continue;

      const template = auto.templateId; // already populated
      if (!template || !template.imageUrl) continue;

      let newlyGenerated = 0;
      const now = new Date();
      const runTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      const currentPollBatchId = `${auto.batchId} [Run ${runTime}]`;

      const templateIdStr = String(template._id || template.id || '');
      const existingDbCerts = await Certificate.find({});

      for (const row of rows) {
        const name = String(row[auto.nameColumn] || '').trim();
        const rawEmail = String(row[auto.emailColumn] || '').trim();
        const email = normalizeEmail(rawEmail);
        if (!name || !email) continue;

        const uniqueHash = calculateUniqueHash(templateIdStr, name, email, auto.batchId);
        const runKey = `${templateIdStr}_${email}_${auto.batchId}`;
        const baseBatch = String(auto.batchId || '').replace(/\s*\[Run \d{2}:\d{2}\]/, '').trim().toLowerCase();
        const comboKey = `${templateIdStr}_${email}_${baseBatch}`;
        const comboKeyTmpl = `${templateIdStr}_${email}`;

        // Tier 0: Persistent disk lock check (0 DB reads, failsafe against quota/network errors)
        if (isEmailSent(uniqueHash) || isEmailSent(runKey) || isEmailSent(comboKey) || isEmailSent(comboKeyTmpl)) {
          processedInRun.add(uniqueHash);
          processedInRun.add(runKey);
          processedInRun.add(comboKey);
          continue;
        }

        // Tier 1: Check in-flight run Set
        if (processedInRun.has(uniqueHash) || processedInRun.has(runKey) || processedInRun.has(comboKey)) {
          continue;
        }

        // Tier 2: Check by uniqueHash in DB
        const existingByHash = await Certificate.findOne({ uniqueHash });
        if (existingByHash) {
          markEmailSent([uniqueHash, runKey, comboKey, comboKeyTmpl]);
          processedInRun.add(uniqueHash);
          processedInRun.add(runKey);
          processedInRun.add(comboKey);
          continue;
        }

        // Tier 3: Check by email + templateId + batchId in DB
        const existingByEmail = existingDbCerts.find(c => {
          if (!c || !c.email) return false;
          const cEmail = normalizeEmail(c.email);
          const cTmplId = String(c.templateId?._id || c.templateId || '');
          const cBatch = String(c.batchId || '');
          return cEmail === email && cTmplId === templateIdStr && (cBatch === auto.batchId || cBatch.startsWith(auto.batchId) || c.isAutomation);
        });

        if (existingByEmail) {
          markEmailSent([uniqueHash, runKey, comboKey, comboKeyTmpl]);
          processedInRun.add(uniqueHash);
          processedInRun.add(runKey);
          processedInRun.add(comboKey);
          continue;
        }

        // Lock in-flight & persistent lock immediately
        processedInRun.add(uniqueHash);
        processedInRun.add(runKey);
        processedInRun.add(comboKey);
        markEmailSent([uniqueHash, runKey, comboKey, comboKeyTmpl]);

        const certId = await generateUniqueId();
        markEmailSent(certId);
        const itemData = { ...row, name, email, certificateId: certId };

        let pdfBytes;
        try {
          pdfBytes = await createCertificatePDF(template, itemData, certId);
        } catch (pdfErr) {
          console.error(`[Poll] PDF gen failed for ${name}:`, pdfErr.message);
          continue;
        }

        const cert = await Certificate.create({
          certificateId: certId,
          name,
          email,
          course: row.course || row.Course || auto.emailSubject || 'Achievement',
          templateId: templateIdStr,
          status: 'Pending',
          createdBy: String(auto.userId),
          batchId: currentPollBatchId,
          isAutomation: true,
          uniqueHash,
          metadata: row,
        });

        try {
          await sendCertEmail(cert, template, auto);
          await Certificate.save({ ...cert, status: 'Sent' });
          await EmailLog.create({ certificateId: certId, recipient: email, status: 'Sent' });
          console.log(`[Poll] ✅ Cert sent to ${email}`);
        } catch (mailErr) {
          await Certificate.save({ ...cert, status: 'Failed' });
          await EmailLog.create({ certificateId: certId, recipient: email, status: 'Failed', error: mailErr.message });
          console.error(`[Poll] ❌ Email failed for ${email}:`, mailErr.message);
        }

        newlyGenerated++;
      }

      // Update automation stats in Firestore
      await FormAutomation.findByIdAndUpdate(auto._id, {
        lastChecked: new Date().toISOString(),
        ...(newlyGenerated > 0 ? { $inc: { certCount: newlyGenerated } } : {}),
      });

      if (newlyGenerated > 0) {
        console.log(`[Poll] Automation "${auto.batchId}": ${newlyGenerated} new certs generated.`);
      }
    } catch (err) {
      console.error(`[Poll] Error for automation ${auto._id}:`, err.message);
    }
  }

  isPollerExecuting = false;
};

// ── Exported starter ─────────────────────────────────────────────────────────
const startFormPoller = () => {
  console.log(`[Poll] Form poller started — checking every ${POLL_INTERVAL_MS / 1000}s`);
  pollOnce();
  setInterval(pollOnce, POLL_INTERVAL_MS);
};

module.exports = { startFormPoller };
