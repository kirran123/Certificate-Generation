/**
 * formPoller.js
 * Runs every 10 seconds. Checks all active FormAutomation docs,
 * fetches their linked Google Sheet, and auto-generates + emails
 * certificates for any new rows not yet processed.
 */

const axios = require('axios');
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

const FormAutomation = require('../models/FormAutomation');
const Certificate = require('../models/Certificate');
const EmailLog = require('../models/EmailLog');
const { createCertificatePDF, calculateUniqueHash } = require('../utils/pdfGenerator');
const { sendEmailWithFailover } = require('../utils/brevoPool');
const { isEmailSent, markEmailSent } = require('../utils/sentLock');

const POLL_INTERVAL_MS = 10_000; // 10 seconds
let isPollerExecuting = false;

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

// ── Main polling function ──────────────────────────────────────────────────

const pollOnce = async () => {
  if (isPollerExecuting) return;
  isPollerExecuting = true;

  let automations;
  try {
    automations = await FormAutomation.find({ active: true }).populate('templateId');
  } catch (e) {
    console.error('[Poll] DB error:', e.message);
    isPollerExecuting = false;
    return;
  }

  const processedInRun = new Set();

  for (const auto of automations) {
    try {
      // Build CSV export URL from stored sheetId + gid
      const exportUrl = `https://docs.google.com/spreadsheets/d/${auto.sheetId}/export?format=csv&gid=${auto.gid}`;
      const response = await axios.get(exportUrl, { responseType: 'arraybuffer', timeout: 10000 });
      const workbook = xlsx.read(response.data, { type: 'buffer' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = xlsx.utils.sheet_to_json(sheet);

      if (!rows || rows.length === 0) continue;

      const template = auto.templateId;
      if (!template || !template.imageUrl) continue;

      const uploadDir = path.join(__dirname, '../uploads');
      const certsDir = path.join(uploadDir, 'certificates');
      if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
      if (!fs.existsSync(certsDir)) fs.mkdirSync(certsDir, { recursive: true });

      let newlyGenerated = 0;

      const now = new Date();
      const runTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      const currentPollBatchId = `${auto.batchId} [Run ${runTime}]`;

      for (const row of rows) {
        const name = String(row[auto.nameColumn] || '').trim();
        const email = String(row[auto.emailColumn] || '').trim().toLowerCase();

        if (!name || !email) continue; // skip incomplete rows

        const dedupKey = `${template._id}_${email}`;

        // 1. Check in-memory run cache
        if (processedInRun.has(dedupKey)) {
          continue;
        }

        // 2. Check persistent sent lock
        if (isEmailSent(dedupKey)) {
          processedInRun.add(dedupKey);
          continue;
        }

        // 3. Dedup check using shared hasher & DB lookup
        const uniqueHash = calculateUniqueHash(template._id, name, email, auto.batchId);
        const existing = await Certificate.findOne({
          $or: [
            { uniqueHash },
            { templateId: template._id, email }
          ]
        });

        if (existing) {
          processedInRun.add(dedupKey);
          markEmailSent([dedupKey, uniqueHash]);
          if (existing.status === 'Sent' || existing.status === 'Pending') {
            continue; // Already generated / sent
          }
        }

        processedInRun.add(dedupKey);

        const certId = existing ? existing.certificateId : await generateUniqueId();
        const itemData = {
          ...row,
          name,
          email,
          certificateId: certId
        };

        // Generate PDF using shared utility
        let pdfBytes;
        try {
          pdfBytes = await createCertificatePDF(template, itemData, certId);
        } catch (pdfErr) {
          console.error(`[Poll] PDF gen failed for ${name}:`, pdfErr.message);
          continue;
        }

        const pdfFileName = `${certId}.pdf`;
        const pdfPath = path.join(certsDir, pdfFileName);
        fs.writeFileSync(pdfPath, pdfBytes);

        let cert = existing;
        if (!cert) {
          cert = await Certificate.create({
            certificateId: certId,
            name,
            email,
            course: row.course || row.Course || auto.emailSubject || 'Achievement',
            templateId: template._id,
            pdfUrl: `/uploads/certificates/${pdfFileName}`,
            status: 'Pending',
            createdBy: auto.userId,
            batchId: currentPollBatchId,
            isAutomation: true,
            uniqueHash,
            metadata: row
          });
        } else {
          cert.pdfUrl = `/uploads/certificates/${pdfFileName}`;
          cert.status = 'Pending';
          await cert.save();
        }

        const base64Pdf = Buffer.from(pdfBytes).toString('base64');
        const emailSubject = auto.emailSubject || 'Your Certificate of Achievement';
        const emailMessage = auto.emailMessage || 'Congratulations! Your certificate has been generated and is attached to this email.';

        const htmlContent = `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;border:1px solid #eee;border-radius:10px;">
            <h2 style="color:#4f46e5;">Your Certificate is Ready! 🎉</h2>
            <p>Hi <strong>${cert.name}</strong>,</p>
            <p>${emailMessage}</p>
            <div style="margin:20px 0;padding:15px;background:#f9fafb;border-radius:8px;">
              <p style="margin:0;font-size:12px;color:#6b7280;">Certificate ID:</p>
              <p style="margin:0;font-weight:bold;font-family:monospace;">${cert.certificateId}</p>
            </div>
            <p style="font-size:14px;color:#374151;">Best Regards,<br/><strong>DigiCertify Team</strong></p>
          </div>`;

        // Send email via Brevo Pool Manager
        try {
          await sendEmailWithFailover({
            to: cert.email,
            name: cert.name,
            subject: emailSubject,
            htmlContent,
            pdfBase64,
            certId
          });

          cert.status = 'Sent';
          await cert.save();
          await EmailLog.create({ certificateId: certId, recipient: email, status: 'Sent' });
          markEmailSent([dedupKey, uniqueHash, certId]);
          console.log(`[Poll] ✅ Cert sent to ${email} (CertID: ${certId})`);
        } catch (mailErr) {
          cert.status = 'Failed';
          await cert.save();
          await EmailLog.create({ certificateId: certId, recipient: email, status: 'Failed', error: mailErr.message });
          console.error(`[Poll] ❌ Email failed for ${email}:`, mailErr.message);
        }

        newlyGenerated++;
      }

      // Update the original automation's stats
      await FormAutomation.findByIdAndUpdate(auto._id, {
        lastChecked: new Date(),
        ...(newlyGenerated > 0 && { $inc: { certCount: newlyGenerated } })
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

// ── Exported starter ───────────────────────────────────────────────────────

const startFormPoller = () => {
  console.log(`[Poll] Form poller started — checking every ${POLL_INTERVAL_MS / 1000}s`);
  pollOnce();
  setInterval(pollOnce, POLL_INTERVAL_MS);
};

module.exports = { startFormPoller };
