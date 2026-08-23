const express = require('express');
const xlsx = require('xlsx');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const axios = require('axios');
const Template = require('../models/Template');
const Certificate = require('../models/Certificate');
const EmailLog = require('../models/EmailLog');
const FormAutomation = require('../models/FormAutomation');
const { protect } = require('../middleware/auth');
const { createCertificatePDF, calculateUniqueHash } = require('../utils/pdfGenerator');
const { sendEmailWithFailover } = require('../utils/brevoPool');

function normalizeEmail(rawEmail) {
  if (!rawEmail) return '';
  let email = String(rawEmail).replace(/\s+/g, '');
  email = email.replace(/^[<"'\s]+|[>"'\s]+$/g, '');
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

const router = express.Router();
const uploadMem = multer({ storage: multer.memoryStorage() });

// ── Generate Unique Cert ID ──────────────────────────────────────────────────
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

// ── Upload and Parse Excel ───────────────────────────────────────────────────
router.post('/upload-data', protect, uploadMem.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  try {
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
    res.json({ data, headers: Object.keys(data[0] || {}) });
  } catch (error) {
    res.status(500).json({ message: 'Failed to parse Excel file', error: error.message });
  }
});

// ── Import Google Sheet ──────────────────────────────────────────────────────
router.post('/upload-sheet', protect, async (req, res) => {
  let { sheetUrl } = req.body;
  if (!sheetUrl) return res.status(400).json({ message: 'No Google Sheet URL provided.' });
  sheetUrl = sheetUrl.trim();

  if (sheetUrl.includes('docs.google.com/forms') || sheetUrl.includes('forms.gle')) {
    return res.status(400).json({ message: 'This looks like a Google Form URL. Please open the form responses in Google Sheets, then paste that Sheets link here.' });
  }

  let docId = '', isWebPublished = false;
  const webPubMatch = sheetUrl.match(/\/d\/e\/([a-zA-Z0-9-_]+)/);
  const standardMatch = sheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (webPubMatch) { docId = webPubMatch[1]; isWebPublished = true; }
  else if (standardMatch) { docId = standardMatch[1]; }
  else if (/^[a-zA-Z0-9-_]{20,}$/.test(sheetUrl)) { docId = sheetUrl; }
  else return res.status(400).json({ message: 'Invalid Google Sheets URL.' });

  const gidMatch = sheetUrl.match(/[#&?]gid=([0-9]+)/);
  const preferredGid = gidMatch ? gidMatch[1] : null;
  const candidateUrls = [];
  if (isWebPublished) {
    candidateUrls.push(`https://docs.google.com/spreadsheets/d/e/${docId}/pub?output=csv`);
    if (preferredGid) candidateUrls.push(`https://docs.google.com/spreadsheets/d/e/${docId}/pub?gid=${preferredGid}&single=true&output=csv`);
  } else {
    if (preferredGid) candidateUrls.push(`https://docs.google.com/spreadsheets/d/${docId}/export?format=csv&gid=${preferredGid}`);
    candidateUrls.push(`https://docs.google.com/spreadsheets/d/${docId}/export?format=csv`);
    candidateUrls.push(`https://docs.google.com/spreadsheets/d/${docId}/gviz/tq?tqx=out:csv`);
  }

  let result = null, privateDetected = false, lastError = null;
  for (const url of [...new Set(candidateUrls)]) {
    try {
      const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 15000, headers: { 'User-Agent': 'Mozilla/5.0' } });
      const text = Buffer.from(response.data).toString('utf8', 0, 300);
      if (text.includes('<html') && (text.includes('accounts.google.com') || text.includes('ServiceLogin'))) { privateDetected = true; continue; }
      const workbook = xlsx.read(response.data, { type: 'buffer' });
      const ws = workbook.Sheets[workbook.SheetNames[0]];
      const data = xlsx.utils.sheet_to_json(ws, { raw: false, defval: '' });
      const headers = (xlsx.utils.sheet_to_json(ws, { header: 1, raw: false })[0] || []).map(String).filter(Boolean);
      if (headers.length > 0 || data.length > 0) { result = { data, headers }; break; }
    } catch (e) {
      if (e.response?.status === 401 || e.response?.status === 403) privateDetected = true;
      lastError = e;
    }
  }

  if (result) return res.json(result);
  if (privateDetected) return res.status(403).json({ message: 'Access denied. Set sheet sharing to "Anyone with the link can view".' });
  res.status(500).json({ message: `Failed to access Google Sheet: ${lastError?.message || 'Check sharing permissions.'}` });
});

// ── Preview single certificate ───────────────────────────────────────────────
router.post('/preview', protect, async (req, res) => {
  try {
    const { templateId, sampleData, layoutConfig, imageUrl, showId, showQr } = req.body;
    let template;
    if (imageUrl && layoutConfig) {
      template = { imageUrl, layoutConfig: layoutConfig.fields || [], qrCode: layoutConfig.qrCode, showId, showQr };
    } else if (templateId) {
      const dbTemplate = await Template.findById(templateId);
      if (dbTemplate) template = { imageUrl: dbTemplate.imageUrl, layoutConfig: layoutConfig || dbTemplate.layoutConfig, qrCode: dbTemplate.qrCode, showId: showId !== undefined ? showId : dbTemplate.showId, showQr: showQr !== undefined ? showQr : dbTemplate.showQr };
    }
    if (!template || !template.imageUrl) return res.status(400).json({ message: 'No template image detected.' });
    const pdfBytes = await createCertificatePDF(template, sampleData || {}, 'CERT000000');
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline' });
    res.send(Buffer.from(pdfBytes));
  } catch (error) {
    res.status(500).json({ message: 'CRITICAL: ' + error.message });
  }
});

// ── Generate Certificates ────────────────────────────────────────────────────
router.post('/generate', protect, async (req, res) => {
  try {
    const { templateId, mappings, rawData, showId: overrideShowId, showQr: overrideShowQr } = req.body;
    if (!rawData || !Array.isArray(rawData) || rawData.length === 0) {
      return res.status(400).json({ message: 'No data provided for generation' });
    }
    const template = await Template.findById(templateId);
    if (!template) return res.status(404).json({ message: 'Template not found' });

    let generatedCount = 0, skippedCount = 0;
    const generatedIds = [];
    const timestamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
    const batchId = req.body.batchId || `Batch ${timestamp}`;

    for (const row of rawData) {
      const itemData = { ...row };
      Object.keys(mappings || {}).forEach(key => {
        let value = row[mappings[key]] || '';
        if (key === 'email' && value) value = normalizeEmail(value);
        itemData[key] = value;
      });
      if (!itemData.name) itemData.name = 'Unknown Recipient';

      const uniqueHash = calculateUniqueHash(templateId, itemData.name, itemData.email, batchId);
      const existing = await Certificate.findOne({ uniqueHash });
      if (existing) { skippedCount++; continue; }

      const certId = await generateUniqueId();
      itemData.certificateId = certId;

      try {
        const renderSettings = {
          ...template,
          layoutConfig: req.body.layoutConfig || template.layoutConfig,
          showId: overrideShowId !== undefined ? overrideShowId : template.showId,
          showQr: overrideShowQr !== undefined ? overrideShowQr : template.showQr,
        };
        // Validate PDF generation (on-demand, no file written to disk)
        await createCertificatePDF(renderSettings, itemData, certId);

        await Certificate.create({
          certificateId: certId,
          name: String(itemData.name),
          email: String(itemData.email || ''),
          course: String(itemData.course || req.body.subject || 'Achievement'),
          templateId: String(template._id),
          status: 'Pending',
          createdBy: String(req.user._id),
          batchId,
          uniqueHash,
          metadata: row,
        });
        generatedIds.push(certId);
        generatedCount++;
      } catch (err) {
        console.error('Failed to generate certificate:', err.message);
      }
    }

    res.json({ message: `Success: ${generatedCount} generated.`, generatedCount, skippedCount, generatedIds, batchId });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ── Send Bulk Emails ─────────────────────────────────────────────────────────
router.post('/send-bulk', protect, async (req, res) => {
  const { certificateIds, subject, message, senderName, senderEmail } = req.body;
  try {
    const certs = await Certificate.find({ certificateId: { $in: certificateIds } });
    const populated = await Certificate.populate(certs, 'templateId');
    let sentCount = 0;

    for (const cert of populated) {
      if (!cert.email) continue;
      try {
        const template = cert.templateId;
        if (!template || !template.imageUrl) throw new Error('Template not found');
        const itemData = { name: cert.name, email: cert.email, course: cert.course, certificateId: cert.certificateId, ...(cert.metadata || {}) };
        const pdfBytes = await createCertificatePDF(template, itemData, cert.certificateId);
        const base64Pdf = Buffer.from(pdfBytes).toString('base64');
        const htmlContent = `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;border:1px solid #eee;border-radius:10px;"><h2 style="color:#4f46e5;">Your Certificate is Ready!</h2><p>Hi ${cert.name},</p><p>${message || 'Congratulations! Your certificate is attached.'}</p><div style="margin:20px 0;padding:15px;background:#f9fafb;border-radius:8px;"><p style="margin:0;font-size:12px;color:#6b7280;">Certificate ID:</p><p style="margin:0;font-weight:bold;font-family:monospace;">${cert.certificateId}</p></div><p style="font-size:14px;color:#374151;">Best Regards,<br/><strong>${senderName || 'DigiCertify'} Team</strong></p></div>`;
        await sendEmailWithFailover({ to: cert.email, name: cert.name, subject: subject || 'Your Certificate of Achievement', htmlContent, pdfBase64: base64Pdf, certId: cert.certificateId, senderName: senderName || 'DigiCertify', senderEmail: senderEmail || 'digicertify00@gmail.com' });
        await Certificate.save({ ...cert, status: 'Sent' });
        await EmailLog.create({ certificateId: cert.certificateId, recipient: cert.email, status: 'Sent' });
        sentCount++;
      } catch (err) {
        await Certificate.save({ ...cert, status: 'Failed' });
        await EmailLog.create({ certificateId: cert.certificateId, recipient: cert.email, status: 'Failed', error: err.message });
      }
    }
    res.json({ message: `Successfully sent ${sentCount} emails.` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ── Download single certificate (on-demand PDF) ──────────────────────────────
router.get('/download/:certId', async (req, res) => {
  try {
    const cert = await Certificate.findOne({ certificateId: req.params.certId });
    if (!cert) return res.status(404).json({ message: 'Certificate not found.' });
    const template = await Template.findById(cert.templateId);
    if (!template || !template.imageUrl) return res.status(404).json({ message: 'Template not found.' });
    const itemData = { name: cert.name, email: cert.email, course: cert.course, certificateId: cert.certificateId, ...(cert.metadata || {}) };
    const pdfBytes = await createCertificatePDF(template, itemData, cert.certificateId);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${cert.certificateId}.pdf"` });
    res.send(Buffer.from(pdfBytes));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ── Download bulk as ZIP ─────────────────────────────────────────────────────
router.get('/download-bulk', protect, async (req, res) => {
  try {
    const batchIdParam = req.query.batchId;
    let certs;
    if (batchIdParam) {
      certs = await Certificate.find({ batchId: batchIdParam });
      if (req.user.role !== 'admin') certs = certs.filter(c => c.createdBy === String(req.user._id));
    } else {
      certs = req.user.role === 'admin'
        ? await Certificate.find({ isArchived: false })
        : await Certificate.find({ createdBy: String(req.user._id), isArchived: false });
    }
    if (!certs.length) return res.status(404).json({ message: 'No certificates found' });

    res.attachment('certificates.zip');
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(res);

    for (const cert of certs) {
      try {
        const template = await Template.findById(cert.templateId);
        if (!template || !template.imageUrl) continue;
        const itemData = { name: cert.name, email: cert.email, course: cert.course, certificateId: cert.certificateId, ...(cert.metadata || {}) };
        const pdfBytes = await createCertificatePDF(template, itemData, cert.certificateId);
        const folder = (cert.batchId || 'Manual').replace(/[<>:"/\\|?*]/g, '_').trim();
        archive.append(Buffer.from(pdfBytes), { name: `${folder}/${cert.certificateId}.pdf` });
      } catch (e) { console.error(`Skip cert ${cert.certificateId}:`, e.message); }
    }
    archive.finalize();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ── Update batch emails ──────────────────────────────────────────────────────
router.post('/update-batch-emails', protect, async (req, res) => {
  const { updates } = req.body;
  if (!updates || !Array.isArray(updates)) return res.status(400).json({ message: 'Invalid updates format' });
  let updatedCount = 0;
  for (const update of updates) {
    if (!update.certificateId || !update.email) continue;
    const result = await Certificate.updateOne(
      { certificateId: update.certificateId, createdBy: String(req.user._id) },
      { $set: { email: update.email.trim().toLowerCase() } }
    );
    if (result.modifiedCount > 0) updatedCount++;
  }
  res.json({ message: `Successfully updated ${updatedCount} certificates.` });
});

// ── Delete single certificate ────────────────────────────────────────────────
router.delete('/delete-certificate/:certId', protect, async (req, res) => {
  try {
    const cert = await Certificate.findOne({ certificateId: req.params.certId });
    if (!cert) return res.status(404).json({ message: 'Certificate not found or unauthorized' });
    if (req.user.role !== 'admin' && cert.createdBy !== String(req.user._id)) return res.status(403).json({ message: 'Unauthorized' });
    await Certificate.deleteOne({ certificateId: req.params.certId });
    res.json({ message: `Successfully deleted certificate "${req.params.certId}".` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ── Delete batch (secure) ────────────────────────────────────────────────────
router.post('/delete-batch-secure', protect, async (req, res) => {
  const { batchId } = req.body;
  if (!batchId) return res.status(400).json({ message: 'Batch ID is required' });
  try {
    const filter = req.user.role === 'admin' ? { batchId } : { batchId, createdBy: String(req.user._id) };
    const result = await Certificate.updateMany(filter, { $set: { isArchived: true } });
    await FormAutomation.deleteMany({ ...filter, active: false });
    res.json({ message: `Successfully archived batch "${batchId}"`, count: result.modifiedCount });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ── Resend batch emails ──────────────────────────────────────────────────────
router.post('/resend-batch/:batchId', protect, async (req, res) => {
  const { batchId } = req.params;
  try {
    const certs = await Certificate.find({ batchId });
    const populated = await Certificate.populate(certs, 'templateId');
    let sentCount = 0;
    for (const cert of populated) {
      if (!cert.email) continue;
      try {
        const template = cert.templateId;
        if (!template || !template.imageUrl) continue;
        const itemData = { name: cert.name, email: cert.email, course: cert.course, certificateId: cert.certificateId, ...(cert.metadata || {}) };
        const pdfBytes = await createCertificatePDF(template, itemData, cert.certificateId);
        const htmlContent = `<div style="font-family:sans-serif;padding:20px;"><h2 style="color:#4f46e5;">Your Certificate is Ready!</h2><p>Hi ${cert.name}, Congratulations! Your certificate is attached.</p><p><strong>${cert.certificateId}</strong></p></div>`;
        await sendEmailWithFailover({ to: cert.email, name: cert.name, subject: 'Your Certificate of Achievement', htmlContent, pdfBase64: Buffer.from(pdfBytes).toString('base64'), certId: cert.certificateId, senderName: 'DigiCertify', senderEmail: 'digicertify00@gmail.com' });
        await Certificate.save({ ...cert, status: 'Sent' });
        await EmailLog.create({ certificateId: cert.certificateId, recipient: cert.email, status: 'Sent' });
        sentCount++;
      } catch (e) {
        await Certificate.save({ ...cert, status: 'Failed' });
        await EmailLog.create({ certificateId: cert.certificateId, recipient: cert.email, status: 'Failed', error: e.message });
      }
    }
    res.json({ message: `Successfully resent ${sentCount} emails for batch "${batchId}".` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ── Resend single certificate ────────────────────────────────────────────────
router.post('/resend-single/:certId', protect, async (req, res) => {
  let cert = null;
  try {
    cert = await Certificate.findOne({ certificateId: req.params.certId });
    if (!cert) return res.status(404).json({ message: 'Certificate not found' });
    if (req.user.role !== 'admin' && cert.createdBy !== String(req.user._id)) return res.status(403).json({ message: 'Unauthorized' });
    if (!cert.email) return res.status(400).json({ message: 'Certificate has no recipient email' });

    cert.email = normalizeEmail(cert.email);
    const template = await Template.findById(cert.templateId);
    if (!template || !template.imageUrl) return res.status(404).json({ message: 'Template not found' });

    const itemData = { name: cert.name, email: cert.email, course: cert.course, certificateId: cert.certificateId, ...(cert.metadata || {}) };
    const pdfBytes = await createCertificatePDF(template, itemData, cert.certificateId);
    const htmlContent = `<div style="font-family:sans-serif;padding:20px;"><h2 style="color:#4f46e5;">Your Certificate is Ready!</h2><p>Hi ${cert.name}, your certificate has been resent.</p><p><strong>${cert.certificateId}</strong></p></div>`;
    await sendEmailWithFailover({ to: cert.email, name: cert.name, subject: 'Your Certificate of Achievement', htmlContent, pdfBase64: Buffer.from(pdfBytes).toString('base64'), certId: cert.certificateId, senderName: 'DigiCertify', senderEmail: 'digicertify00@gmail.com' });
    await Certificate.save({ ...cert, status: 'Sent' });
    await EmailLog.create({ certificateId: cert.certificateId, recipient: cert.email, status: 'Sent' });
    res.json({ message: `Successfully resent email to ${cert.email}` });
  } catch (error) {
    if (cert) {
      await Certificate.save({ ...cert, status: 'Failed' });
      await EmailLog.create({ certificateId: cert.certificateId, recipient: cert.email, status: 'Failed', error: error.message });
    }
    res.status(500).json({ message: error.message });
  }
});

// ── My Generations ───────────────────────────────────────────────────────────
router.get('/my-generations', protect, async (req, res) => {
  try {
    const certs = await Certificate.find({ createdBy: String(req.user._id), isArchived: false });
    const populated = await Certificate.populate(certs, 'templateId');
    populated.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ── Form Automations ─────────────────────────────────────────────────────────
router.post('/form-automation', protect, async (req, res) => {
  const { sheetUrl, templateId, nameColumn, emailColumn, batchId, emailSubject, emailMessage } = req.body;
  if (!sheetUrl || !templateId || !nameColumn || !emailColumn) return res.status(400).json({ message: 'sheetUrl, templateId, nameColumn and emailColumn are required.' });
  const idMatch = sheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (!idMatch) return res.status(400).json({ message: 'Invalid Google Sheets URL.' });
  const sheetId = idMatch[1];
  const gidMatch = sheetUrl.match(/[#&]gid=([0-9]+)/);
  const gid = gidMatch ? gidMatch[1] : '0';
  const finalBatchId = batchId || `Form Auto – ${new Date().toLocaleDateString('en-GB')}`;
  try {
    const automation = await FormAutomation.create({ userId: String(req.user._id), templateId: String(templateId), sheetUrl, sheetId, gid, nameColumn, emailColumn, batchId: finalBatchId, emailSubject: emailSubject || 'Your Certificate of Achievement', emailMessage: emailMessage || 'Congratulations! Your certificate is attached.' });
    res.status(201).json({ message: 'Automation created. Poller will check every 10 seconds.', automation });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/form-automations', protect, async (req, res) => {
  try {
    const filter = req.user.role === 'admin' ? {} : { userId: String(req.user._id) };
    const list = await FormAutomation.findAndPopulate(filter);
    const allCerts = await Certificate.find({ status: 'Sent' });
    const enriched = list.map(auto => {
      const sentCount = allCerts.filter(c => c.batchId && c.batchId.startsWith(auto.batchId)).length;
      return { ...auto, certCount: sentCount };
    });
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/form-automations/cleanup', protect, async (req, res) => {
  try {
    const filter = req.user.role === 'admin' ? { active: false } : { active: false, userId: String(req.user._id) };
    const result = await FormAutomation.deleteMany(filter);
    res.json({ message: `Cleaned up ${result.deletedCount} stale automation records.` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch('/form-automation/:id', protect, async (req, res) => {
  try {
    const auto = await FormAutomation.findById(req.params.id);
    if (!auto) return res.status(404).json({ message: 'Automation not found.' });
    if (req.user.role !== 'admin' && auto.userId !== String(req.user._id)) return res.status(403).json({ message: 'Forbidden' });
    const newActive = req.body.active !== undefined ? req.body.active : !auto.active;
    const updated = await FormAutomation.findByIdAndUpdate(req.params.id, { active: newActive });
    res.json({ message: `Automation ${newActive ? 'resumed' : 'paused'}.`, automation: updated });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/form-automation/:id', protect, async (req, res) => {
  try {
    const auto = await FormAutomation.findById(req.params.id);
    if (!auto) return res.status(404).json({ message: 'Automation not found.' });
    if (req.user.role !== 'admin' && auto.userId !== String(req.user._id)) return res.status(403).json({ message: 'Forbidden' });
    await FormAutomation.deleteOne(req.params.id);
    res.json({ message: 'Automation deleted.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
