const express = require('express');
const xlsx = require('xlsx');
const multer = require('multer');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const archiver = require('archiver');
const axios = require('axios');
const Template = require('../models/Template');
const Certificate = require('../models/Certificate');
const EmailLog = require('../models/EmailLog');
const Counter = require('../models/Counter');
const FormAutomation = require('../models/FormAutomation');
const { protect, admin } = require('../middleware/auth');
const { createCertificatePDF, calculateUniqueHash, getRelativePath } = require('../utils/pdfGenerator');
const { sendEmailWithFailover } = require('../utils/brevoPool');

function normalizeEmail(rawEmail) {
  if (!rawEmail) return '';
  let email = String(rawEmail);
  email = email.replace(/\s+/g, '');
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

const router = express.Router();

const uploadMem = multer({ storage: multer.memoryStorage() });

// Upload and Parse Excel File
router.post('/upload-data', protect, uploadMem.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

  try {
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
    res.json({ data, headers: Object.keys(data[0] || {}) });
  } catch (error) {
    res.status(500).json({ message: 'Failed to parse Excel file', error: error.message });
  }
});

// Import Google Sheets Link
router.post('/upload-sheet', protect, async (req, res) => {
  let { sheetUrl } = req.body;

  if (!sheetUrl) return res.status(400).json({ message: 'No Google Sheet URL provided.' });

  sheetUrl = sheetUrl.trim();

  if (sheetUrl.includes('docs.google.com/forms') || sheetUrl.includes('forms.gle')) {
    return res.status(400).json({
      message: 'This looks like a Google Form URL. Please open the form responses in Google Sheets (click the green Sheets icon in the form), then paste that Sheets link here.'
    });
  }

  let docId = '';
  let isWebPublished = false;

  const webPubMatch = sheetUrl.match(/\/d\/e\/([a-zA-Z0-9-_]+)/);
  const standardMatch = sheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);

  if (webPubMatch) {
    docId = webPubMatch[1];
    isWebPublished = true;
  } else if (standardMatch) {
    docId = standardMatch[1];
  } else if (/^[a-zA-Z0-9-_]{20,}$/.test(sheetUrl)) {
    docId = sheetUrl;
  } else {
    return res.status(400).json({ message: 'Invalid Google Sheets URL. Please copy the URL from the browser address bar while the sheet is open.' });
  }

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
    if (preferredGid) candidateUrls.push(`https://docs.google.com/spreadsheets/d/${docId}/gviz/tq?tqx=out:csv&gid=${preferredGid}`);
    ['0', '1', '2', '3'].forEach(g => {
      if (g !== preferredGid) candidateUrls.push(`https://docs.google.com/spreadsheets/d/${docId}/export?format=csv&gid=${g}`);
    });
  }

  const uniqueUrls = [...new Set(candidateUrls)];
  let privateDetected = false;
  let notFoundDetected = false;
  let lastError = null;
  let result = null;

  for (const url of uniqueUrls) {
    try {
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 15000,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      });

      const text = Buffer.from(response.data).toString('utf8', 0, 300);
      if (text.includes('<html') && (text.includes('accounts.google.com') || text.includes('ServiceLogin') || text.includes('Sign in'))) {
        privateDetected = true;
        continue;
      }

      const workbook = xlsx.read(response.data, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const ws = workbook.Sheets[sheetName];

      const data = xlsx.utils.sheet_to_json(ws, { raw: false, defval: '' });
      const headers = (xlsx.utils.sheet_to_json(ws, { header: 1, raw: false })[0] || []).map(String).filter(Boolean);

      if (headers.length > 0 || data.length > 0) {
        result = { data, headers };
        break;
      }
    } catch (e) {
      if (e.response?.status === 401 || e.response?.status === 403) privateDetected = true;
      else if (e.response?.status === 404) notFoundDetected = true;
      lastError = e;
    }
  }

  if (result) {
    if (result.data.length === 0) {
      return res.json({
        data: [],
        headers: result.headers,
        warning: 'The sheet has column headers but no data rows yet. Auto-cert will generate certificates as new rows are added.'
      });
    }

    return res.json({
      data: result.data,
      headers: result.headers
    });
  }

  if (privateDetected || notFoundDetected) {
    return res.status(403).json({
      message: 'Access denied or sheet not found. Go to Share → General access → set to "Anyone with the link can view", then try again.'
    });
  }

  res.status(500).json({
    message: `Failed to access Google Sheet: ${lastError?.message || 'Check sheet link & sharing permissions.'}`
  });
});


// Removed local createCertificatePDF - now using shared utility in utils/pdfGenerator.js

// Generate Unique ID ATOMICALLY
const generateUniqueId = async () => {
  let certId;
  let isUnique = false;

  while (!isUnique) {
    const randomDigits = Math.floor(100000 + Math.random() * 900000).toString();
    certId = `CERT${randomDigits}`;
    const existing = await Certificate.findOne({ certificateId: certId });
    if (!existing) isUnique = true;
  }
  return certId;
};


// Preview single certificate
router.post('/preview', protect, async (req, res) => {
  try {
    const { templateId, sampleData, layoutConfig, imageUrl, showId, showQr } = req.body;

    let template;
    // Step 1: ALWAYS prioritize live data from the body for Instant Preview
    if (imageUrl && layoutConfig) {
      template = {
        imageUrl,
        layoutConfig: layoutConfig.fields || [],
        qrCode: layoutConfig.qrCode,
        showId: showId !== undefined ? showId : true,
        showQr: showQr !== undefined ? showQr : true
      };
    }
    // Step 2: Fallback to database only if live data is missing
    else if (templateId) {
      try {
        const dbTemplate = await Template.findById(templateId);
        if (dbTemplate) {
          template = {
            imageUrl: dbTemplate.imageUrl,
            layoutConfig: layoutConfig || dbTemplate.layoutConfig, // Use override if available
            qrCode: (layoutConfig && layoutConfig.qrCode) || dbTemplate.qrCode,
            showId: showId !== undefined ? showId : dbTemplate.showId,
            showQr: showQr !== undefined ? showQr : dbTemplate.showQr
          };
        }
      } catch (e) { template = null; }
    }

    if (!template || !template.imageUrl) {
      return res.status(400).json({ message: 'No template image detected. Please upload an image first.' });
    }

    // Logic to find the template image
    let templatePath = '';
    const isRemote = template.imageUrl && template.imageUrl.startsWith('http');

    if (!isRemote) {
      const cleanUrl = getRelativePath(template.imageUrl);
      templatePath = path.join(__dirname, '..', cleanUrl);
    }

    // Check if we have either the file OR the base64 backup OR it's remote
    if (!isRemote && !fs.existsSync(templatePath) && !template.imageBase64) {
      console.error('Template image not found locally or in DB:', templatePath);
      return res.status(404).json({ message: `Template image file not found on server. Please re-upload the template or save it again to create a backup.` });
    }

    const pdfBytes = await createCertificatePDF(template, sampleData || {}, 'CERT000000');

    // Step 3: Return raw binary buffer with correct MIME type
    // This prevents corruption and ensures all browsers can render the PDF correctly
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Length': pdfBytes.length,
      'Content-Disposition': 'inline', // Display in browser instead of forcing download
    });

    res.send(Buffer.from(pdfBytes));
  } catch (error) {
    console.error('Preview error:', error);
    res.status(500).json({
      message: 'CRITICAL: ' + error.message
    });
  }
});

// Generate Certificates 
router.post('/generate', protect, async (req, res) => {
  try {
    const { templateId, mappings, rawData, showId: overrideShowId, showQr: overrideShowQr } = req.body;

    console.log('--- GENERATION DIAGNOSTICS ---');
    console.log('Template ID:', templateId);
    console.log('Mappings:', JSON.stringify(mappings));
    console.log('RawData Count:', rawData ? rawData.length : 'NULL');
    if (rawData && rawData.length > 0) {
      console.log('First Row Sample:', JSON.stringify(rawData[0]));
    }

    if (!rawData || !Array.isArray(rawData) || rawData.length === 0) {
      console.log('ABORTING: No rawData provided.');
      return res.status(400).json({ message: 'No data provided for generation (Excel file may be empty or lost during page refresh)' });
    }

    const template = await Template.findById(templateId);
    if (!template) return res.status(404).json({ message: 'Template not found' });

    const uploadDir = path.join(__dirname, '../uploads');
    const certsDir = path.join(uploadDir, 'certificates');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    if (!fs.existsSync(certsDir)) fs.mkdirSync(certsDir, { recursive: true });

    let generatedCount = 0;
    let skippedCount = 0;
    const generatedIds = [];

    // Ensure we have a valid batch ID
    const timestamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
    const batchId = req.body.batchId || `Batch ${timestamp}`;

    for (const row of rawData) {
      // Build mapped item data
      const itemData = { ...row };
      Object.keys(mappings || {}).forEach(key => {
        const sourceHeader = mappings[key];
        let value = row[sourceHeader] || '';

        // Normalize email
        if (key === 'email' && value) {
          value = normalizeEmail(value);
        }

        itemData[key] = value;
      });

      // Extract metadata (Full row data for on-demand regeneration)
      const metadata = { ...row };

      // Special handling: if 'name' is missing, fallback to 'Unknown Recipient'
      if (!itemData.name) {
        console.warn(`[Warning] Name mapping yielded empty result for row. Source header: ${mappings.name}`);
        itemData.name = 'Unknown Recipient';
      }

      // Deduplication check using shared helper
      const uniqueHash = calculateUniqueHash(templateId, itemData.name, itemData.email, batchId);

      const existing = await Certificate.findOne({ uniqueHash, templateId });
      if (existing) {
        skippedCount++;
        continue;
      }

      const certId = await generateUniqueId();
      itemData.certificateId = certId;

      try {
        // Merge template settings with potential overrides for this batch
        const liveLayout = req.body.layoutConfig;
        const renderSettings = {
          ...template.toObject(),
          layoutConfig: liveLayout || template.layoutConfig,
          showId: overrideShowId !== undefined ? overrideShowId : template.showId,
          showQr: overrideShowQr !== undefined ? overrideShowQr : template.showQr
        };

        const pdfBytes = await createCertificatePDF(renderSettings, itemData, certId);
        const pdfFileName = `${certId}.pdf`;
        const pdfPath = path.join(certsDir, pdfFileName);
        fs.writeFileSync(pdfPath, pdfBytes);

        // Save to MongoDB with strict field assignment
        await Certificate.create({
          certificateId: certId,
          name: String(itemData.name),
          email: String(itemData.email || ''),
          course: String(itemData.course || req.body.subject || 'Achievement'),
          templateId: template._id,
          pdfUrl: `/uploads/certificates/${pdfFileName}`,
          status: 'Pending',
          createdBy: req.user._id,
          batchId: batchId,
          uniqueHash: uniqueHash,
          metadata: metadata
        });

        generatedIds.push(certId);
        generatedCount++;
      } catch (err) {
        console.error('Failed to generate individual certificate:', err);
      }
    }

    console.log(`Success: ${generatedCount} generated, ${skippedCount} skipped.`);
    res.json({
      message: `Success: ${generatedCount} generated.`,
      generatedCount,
      skippedCount,
      generatedIds,
      batchId
    });
  } catch (error) {
    console.error('Generation Error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Send bulk emails with 5-key Brevo Pool silent failover & on-demand PDF fallback
router.post('/send-bulk', protect, async (req, res) => {
  const { certificateIds, subject, message, senderName, senderEmail } = req.body;

  try {
    const certs = await Certificate.find({ certificateId: { $in: certificateIds } }).populate('templateId');

    let sentCount = 0;
    for (const cert of certs) {
      if (!cert.email) continue;

      try {
        let pdfBuffer = null;
        const pdfPath = cert.pdfUrl ? path.join(__dirname, '..', cert.pdfUrl) : null;

        if (pdfPath && fs.existsSync(pdfPath)) {
          pdfBuffer = fs.readFileSync(pdfPath);
        } else if (cert.templateId && cert.templateId.imageUrl) {
          // On-demand PDF generation fallback (solves Render filesystem reset)
          const itemData = {
            name: cert.name,
            email: cert.email,
            course: cert.course,
            certificateId: cert.certificateId,
            ...(cert.metadata ? Object.fromEntries(cert.metadata) : {})
          };
          const pdfBytes = await createCertificatePDF(
            {
              imageUrl: cert.templateId.imageUrl,
              layoutConfig: cert.templateId.layoutConfig,
              qrCode: cert.templateId.qrCode,
              showId: cert.templateId.showId,
              showQr: cert.templateId.showQr
            },
            itemData,
            cert.certificateId
          );
          pdfBuffer = Buffer.from(pdfBytes);
        }

        if (!pdfBuffer) {
          throw new Error(`Could not locate or render PDF for certificate ${cert.certificateId}`);
        }

        const base64Pdf = pdfBuffer.toString('base64');
        const senderEmailFinal = senderEmail || 'digicertify00@gmail.com';
        const senderNameFinal = senderName || 'DigiCertify';

        const htmlContent = `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: #4f46e5;">Your Certificate is Ready!</h2>
            <p>Hi ${cert.name},</p>
            <p>${message || 'Congratulations on your achievement! Please find your official certificate attached to this email.'}</p>
            <div style="margin: 20px 0; padding: 15px; background: #f9fafb; border-radius: 8px;">
              <p style="margin: 0; font-size: 12px; color: #6b7280;">Certificate ID:</p>
              <p style="margin: 0; font-weight: bold; font-family: monospace;">${cert.certificateId}</p>
            </div>
            <p style="font-size: 14px; color: #374151;">Best Regards,<br/><strong>${senderNameFinal} Team</strong></p>
          </div>
        `;

        // Send via 5-key Brevo Pool with silent zero-error failover
        await sendEmailWithFailover({
          to: cert.email,
          name: cert.name,
          subject: subject || 'Your Certificate of Achievement',
          htmlContent,
          pdfBase64: base64Pdf,
          certId: cert.certificateId,
          senderName: senderNameFinal,
          senderEmail: senderEmailFinal
        });

        cert.status = 'Sent';
        await cert.save();

        await EmailLog.create({
          certificateId: cert.certificateId,
          recipient: cert.email,
          status: 'Sent'
        });
        sentCount++;
      } catch (err) {
        console.error(`[Send-Bulk Error] ${cert.email}:`, err.message);
        cert.status = 'Failed';
        await cert.save();
        await EmailLog.create({
          certificateId: cert.certificateId,
          recipient: cert.email,
          status: 'Failed',
          error: err.message
        });
      }
    }
    res.json({ message: `Successfully sent ${sentCount} emails.` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ── Download single certificate (regenerate on-demand from DB) ────────────
// This route never depends on the local disk — it regenerates the PDF from
// the stored template + record data every time, solving the Render
// ephemeral filesystem problem ("Cannot GET /uploads/certificates/…").
router.get('/download/:certId', async (req, res) => {
  try {
    const cert = await Certificate.findOne({ certificateId: req.params.certId })
      .populate('templateId');

    if (!cert) return res.status(404).json({ message: 'Certificate not found.' });

    const template = cert.templateId;
    if (!template || !template.imageUrl) {
      return res.status(404).json({ message: 'Template not found for this certificate. It may have been deleted.' });
    }

    const { getRelativePath } = require('../utils/pdfGenerator');
    const isRemote = template.imageUrl && template.imageUrl.startsWith('http');
    let templatePath = '';

    if (!isRemote) {
      const cleanUrl = getRelativePath(template.imageUrl);
      templatePath = path.join(__dirname, '..', cleanUrl);
    }

    if (!isRemote && !fs.existsSync(templatePath) && !template.imageBase64) {
      return res.status(404).json({ message: 'Template image file not found on server and no backup available. Please re-upload the template.' });
    }

    // Build the data object for re-rendering
    const itemData = {
      name: cert.name,
      email: cert.email,
      course: cert.course,
      certificateId: cert.certificateId,
      ...(cert.metadata ? Object.fromEntries(cert.metadata) : {})
    };

    const pdfBytes = await createCertificatePDF(
      {
        imageUrl: template.imageUrl,
        imageBase64: template.imageBase64,
        layoutConfig: template.layoutConfig,
        qrCode: template.qrCode,
        showId: template.showId,
        showQr: template.showQr
      },
      itemData,
      cert.certificateId
    );

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Length': pdfBytes.length,
      'Content-Disposition': `attachment; filename="${cert.certificateId}.pdf"`,
    });
    res.send(Buffer.from(pdfBytes));
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Download bulk certificates as ZIP (Regenerate on-demand for Render stability)
router.get('/download-bulk', protect, async (req, res) => {
  try {
    const filter = req.user.role === 'admin' ? {} : { createdBy: req.user._id };
    const certs = await Certificate.find(filter).populate('templateId');

    if (certs.length === 0) {
      return res.status(404).json({ message: 'No certificates found' });
    }

    res.attachment('certificates.zip');
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(res);

    for (const cert of certs) {
      try {
        const template = cert.templateId;
        if (!template || !template.imageUrl) continue;

        // Determine folder name (Batch Name)
        let batchFolderName = cert.batchId || 'Manual Generations';
        // Sanitize folder name for file system safety
        batchFolderName = batchFolderName.replace(/[<>:"/\\|?*]/g, '_').trim();

        const isRemote = template.imageUrl && template.imageUrl.startsWith('http');
        let templatePath = '';

        if (!isRemote) {
          const cleanUrl = getRelativePath(template.imageUrl);
          templatePath = path.join(__dirname, '..', cleanUrl);
        }

        if (!isRemote && !fs.existsSync(templatePath) && !template.imageBase64) {
          console.warn(`Skipping ${cert.certificateId} - Template not found and no backup available.`);
          continue;
        }

        // Build the data object for re-rendering
        const itemData = {
          name: cert.name,
          email: cert.email,
          course: cert.course,
          certificateId: cert.certificateId,
          ...(cert.metadata ? Object.fromEntries(cert.metadata) : {})
        };

        const pdfBytes = await createCertificatePDF(
          {
            imageUrl: template.imageUrl,
            imageBase64: template.imageBase64,
            layoutConfig: template.layoutConfig,
            qrCode: template.qrCode,
            showId: template.showId,
            showQr: template.showQr
          },
          itemData,
          cert.certificateId
        );

        // Add to ZIP within the batch folder
        archive.append(Buffer.from(pdfBytes), { name: `${batchFolderName}/${cert.certificateId}.pdf` });
      } catch (certError) {
        console.error(`Error adding cert ${cert.certificateId} to bulk download:`, certError);
      }
    }

    archive.finalize();
  } catch (error) {
    console.error('Bulk download error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Update emails for a batch of certificates
router.post('/update-batch-emails', protect, async (req, res) => {
  const { updates } = req.body; // Array of { certificateId, email }

  if (!updates || !Array.isArray(updates)) {
    return res.status(400).json({ message: 'Invalid updates format' });
  }

  try {
    let updatedCount = 0;
    for (const update of updates) {
      if (!update.certificateId || !update.email) continue;

      const email = update.email.trim().toLowerCase();

      const result = await Certificate.updateOne(
        { certificateId: update.certificateId, createdBy: req.user._id },
        { $set: { email: email } }
      );

      if (result.modifiedCount > 0) updatedCount++;
    }

    res.json({ message: `Successfully updated ${updatedCount} certificates.` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete a single certificate
router.delete('/delete-certificate/:certId', protect, async (req, res) => {
  const { certId } = req.params;
  try {
    const filter = req.user.role === 'admin' ? { certificateId: certId } : { certificateId: certId, createdBy: req.user._id };
    const cert = await Certificate.findOne(filter);

    if (!cert) {
      return res.status(404).json({ message: 'Certificate not found or unauthorized' });
    }

    // Delete physical PDF file if it exists
    if (cert.pdfUrl) {
      const filePath = path.join(__dirname, '..', cert.pdfUrl);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (err) {
          console.error(`Failed to delete PDF file: ${filePath}`, err);
        }
      }
    }

    // Delete certificate from DB
    await Certificate.deleteOne(filter);

    res.json({ message: `Successfully deleted certificate "${certId}".` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Secure delete batch (Body-based to handle spaces/special characters)
router.post('/delete-batch-secure', protect, async (req, res) => {
  const { batchId } = req.body;
  if (!batchId) return res.status(400).json({ message: 'Batch ID is required' });
  
  try {
    const filter = req.user.role === 'admin' ? { batchId } : { batchId, createdBy: req.user._id };
    const certs = await Certificate.find(filter);
    
    // Delete physical PDF files
    for (const cert of certs) {
      if (cert.pdfUrl) {
        // Handle both dynamic and static URL formats for cleanup
        const cleanPath = cert.pdfUrl.includes('download') 
          ? path.join(__dirname, '../uploads/certificates', `${cert.certificateId}.pdf`)
          : path.join(__dirname, '..', cert.pdfUrl);

        if (fs.existsSync(cleanPath)) {
          try { fs.unlinkSync(cleanPath); } catch (err) { console.error('File delete fail:', err.message); }
        }
      }
    }

    // Soft delete: Mark all certificates in batch as archived
    const result = await Certificate.updateMany(filter, { $set: { isArchived: true, pdfUrl: null } });
    await FormAutomation.deleteMany({ ...filter, active: false });

    res.json({ message: `Successfully archived batch "${batchId}"`, count: result.modifiedCount });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Resend emails for an entire batch (Retry failed ones or all) with 5-key Brevo pool & PDF fallback
router.post('/resend-batch/:batchId', protect, async (req, res) => {
  const { batchId } = req.params;

  try {
    const filter = req.user.role === 'admin' ? { batchId } : { batchId, createdBy: req.user._id };
    const certs = await Certificate.find(filter).populate('templateId');

    let sentCount = 0;
    for (const cert of certs) {
      if (!cert.email) continue;

      try {
        let pdfBuffer = null;
        const pdfPath = cert.pdfUrl ? path.join(__dirname, '..', cert.pdfUrl) : null;

        if (pdfPath && fs.existsSync(pdfPath)) {
          pdfBuffer = fs.readFileSync(pdfPath);
        } else if (cert.templateId && cert.templateId.imageUrl) {
          const itemData = {
            name: cert.name,
            email: cert.email,
            course: cert.course,
            certificateId: cert.certificateId,
            ...(cert.metadata ? Object.fromEntries(cert.metadata) : {})
          };
          const pdfBytes = await createCertificatePDF(
            {
              imageUrl: cert.templateId.imageUrl,
              imageBase64: cert.templateId.imageBase64,
              layoutConfig: cert.templateId.layoutConfig,
              qrCode: cert.templateId.qrCode,
              showId: cert.templateId.showId,
              showQr: cert.templateId.showQr
            },
            itemData,
            cert.certificateId
          );
          pdfBuffer = Buffer.from(pdfBytes);
        }

        if (!pdfBuffer) continue;

        const base64Pdf = pdfBuffer.toString('base64');
        const htmlContent = `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: #4f46e5;">Your Certificate is Ready!</h2>
            <p>Hi ${cert.name},</p>
            <p>Congratulations! Your certificate is attached.</p>
            <div style="margin: 20px 0; padding: 15px; background: #f9fafb; border-radius: 8px;">
              <p style="margin: 0; font-size: 12px; color: #6b7280;">Certificate ID:</p>
              <p style="margin: 0; font-weight: bold; font-family: monospace;">${cert.certificateId}</p>
            </div>
          </div>
        `;

        await sendEmailWithFailover({
          to: cert.email,
          name: cert.name,
          subject: 'Your Certificate of Achievement',
          htmlContent,
          pdfBase64: base64Pdf,
          certId: cert.certificateId,
          senderName: 'DigiCertify',
          senderEmail: 'digicertify00@gmail.com'
        });

        cert.status = 'Sent';
        await cert.save();

        await EmailLog.create({
          certificateId: cert.certificateId,
          recipient: cert.email,
          status: 'Sent'
        });
        sentCount++;
      } catch (e) {
        console.error(`Resend failed for ${cert.email}:`, e.message);
        cert.status = 'Failed';
        await cert.save();
        await EmailLog.create({
          certificateId: cert.certificateId,
          recipient: cert.email,
          status: 'Failed',
          error: e.message
        });
      }
    }
    res.json({ message: `Successfully resent ${sentCount} emails for batch "${batchId}".` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Resend email for a single certificate
router.post('/resend-single/:certId', protect, async (req, res) => {
  const { certId } = req.params;
  let cert = null;

  try {
    const filter = req.user.role === 'admin' ? { certificateId: certId } : { certificateId: certId, createdBy: req.user._id };
    cert = await Certificate.findOne(filter).populate('templateId');

    if (!cert) {
      return res.status(404).json({ message: 'Certificate not found or unauthorized' });
    }

    if (!cert.email) {
      return res.status(400).json({ message: 'Certificate has no recipient email address' });
    }

    // Clean & normalize email address before sending
    cert.email = normalizeEmail(cert.email);

    let pdfBuffer = null;
    const pdfPath = cert.pdfUrl ? path.join(__dirname, '..', cert.pdfUrl) : null;

    if (pdfPath && fs.existsSync(pdfPath)) {
      pdfBuffer = fs.readFileSync(pdfPath);
    } else if (cert.templateId && cert.templateId.imageUrl) {
      const itemData = {
        name: cert.name,
        email: cert.email,
        course: cert.course,
        certificateId: cert.certificateId,
        ...(cert.metadata ? Object.fromEntries(cert.metadata) : {})
      };
      const pdfBytes = await createCertificatePDF(
        {
          imageUrl: cert.templateId.imageUrl,
          imageBase64: cert.templateId.imageBase64,
          layoutConfig: cert.templateId.layoutConfig,
          qrCode: cert.templateId.qrCode,
          showId: cert.templateId.showId,
          showQr: cert.templateId.showQr
        },
        itemData,
        cert.certificateId
      );
      pdfBuffer = Buffer.from(pdfBytes);
    }

    if (!pdfBuffer) {
      return res.status(400).json({ message: 'Could not render PDF for this certificate' });
    }

    const base64Pdf = pdfBuffer.toString('base64');
    const htmlContent = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #4f46e5;">Your Certificate is Ready! 🎉</h2>
        <p>Hi <strong>${cert.name}</strong>,</p>
        <p>Your certificate has been sent successfully.</p>
        <div style="margin: 20px 0; padding: 15px; background: #f9fafb; border-radius: 8px;">
          <p style="margin: 0; font-size: 12px; color: #6b7280;">Certificate ID:</p>
          <p style="margin: 0; font-weight: bold; font-family: monospace;">${cert.certificateId}</p>
        </div>
        <p style="font-size: 14px; color: #374151;">Best Regards,<br/><strong>DigiCertify Team</strong></p>
      </div>
    `;

    await sendEmailWithFailover({
      to: cert.email,
      name: cert.name,
      subject: 'Your Certificate of Achievement',
      htmlContent,
      pdfBase64: base64Pdf,
      certId: cert.certificateId,
      senderName: 'DigiCertify',
      senderEmail: 'digicertify00@gmail.com'
    });

    cert.status = 'Sent';
    await cert.save();

    await EmailLog.create({
      certificateId: cert.certificateId,
      recipient: cert.email,
      status: 'Sent'
    });

    res.json({ message: `Successfully resent email to ${cert.email}` });
  } catch (error) {
    console.error(`Resend single failed for ${certId}:`, error.message);
    if (cert) {
      cert.status = 'Failed';
      await cert.save();
      await EmailLog.create({
        certificateId: cert.certificateId,
        recipient: cert.email,
        status: 'Failed',
        error: error.message
      });
    }
    res.status(500).json({ message: `Failed to resend email: ${error.message}` });
  }
});


// Get certificates generated BY the logged-in user
router.get('/my-generations', protect, async (req, res) => {
  try {
    console.log(`[Dashboard] Fetching generations for user: ${req.user.email} (${req.user._id})`);

    // Convert to string to ensure comparison works if stored as string, 
    // but Mongoose usually handles ObjectId automatically.
    const certs = await Certificate.find({
      isArchived: { $ne: true },
      $or: [
        { createdBy: req.user._id },
        { createdBy: { $exists: false } }
      ]
    }).populate('templateId', 'name').populate('createdBy', 'name email');

    console.log(`[Dashboard] Found ${certs.length} certificates for user ${req.user.email}`);
    res.json(certs);
  } catch (error) {
    console.error(`[Dashboard Error] Failed to fetch generations for ${req.user?.email}:`, error);
    res.status(500).json({ message: error.message });
  }
});


// ── Form Automation Routes ─────────────────────────────────────────────────

// Create a new form automation
router.post('/form-automation', protect, async (req, res) => {
  const { sheetUrl, templateId, nameColumn, emailColumn, batchId, emailSubject, emailMessage } = req.body;
  if (!sheetUrl || !templateId || !nameColumn || !emailColumn) {
    return res.status(400).json({ message: 'sheetUrl, templateId, nameColumn and emailColumn are required.' });
  }

  // Extract spreadsheet ID and gid from URL
  const idMatch = sheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (!idMatch) return res.status(400).json({ message: 'Invalid Google Sheets URL.' });
  const sheetId = idMatch[1];
  const gidMatch = sheetUrl.match(/[#&]gid=([0-9]+)/);
  const gid = gidMatch ? gidMatch[1] : '0';

  const finalBatchId = batchId || `Form Auto – ${new Date().toLocaleDateString('en-GB')}`;

  try {
    const automation = await FormAutomation.create({
      userId: req.user._id,
      templateId,
      sheetUrl,
      sheetId,
      gid,
      nameColumn,
      emailColumn,
      batchId: finalBatchId,
      emailSubject,
      emailMessage
    });
    res.status(201).json({ message: 'Automation created. Poller will check every 10 seconds.', automation });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// List all automations for current user — with accurate sent count from Certificate collection
router.get('/form-automations', protect, async (req, res) => {
  try {
    const filter = req.user.role === 'admin' ? {} : { userId: req.user._id };
    const list = await FormAutomation.find(filter)
      .populate('templateId', 'name')
      .populate('userId', 'name email');

    // For each automation, get the real sent count from the Certificate collection
    const enriched = await Promise.all(list.map(async (auto) => {
      const obj = auto.toObject();
      // Count certs whose batchId starts with this automation's batchId
      const sentCount = await Certificate.countDocuments({
        batchId: { $regex: `^${obj.batchId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, $options: 'i' },
        status: 'Sent'
      });
      obj.certCount = sentCount;
      return obj;
    }));

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Cleanup stale snapshot automation records (active: false) — keeps sidebar clean
router.delete('/form-automations/cleanup', protect, async (req, res) => {
  try {
    const filter = req.user.role === 'admin'
      ? { active: false }
      : { active: false, userId: req.user._id };
    const result = await FormAutomation.deleteMany(filter);
    res.json({ message: `Cleaned up ${result.deletedCount} stale automation records.` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Toggle active / pause
router.patch('/form-automation/:id', protect, async (req, res) => {
  try {
    const filter = req.user.role === 'admin'
      ? { _id: req.params.id }
      : { _id: req.params.id, userId: req.user._id };
    const auto = await FormAutomation.findOne(filter);
    if (!auto) return res.status(404).json({ message: 'Automation not found.' });
    auto.active = req.body.active !== undefined ? req.body.active : !auto.active;
    await auto.save();
    res.json({ message: `Automation ${auto.active ? 'resumed' : 'paused'}.`, automation: auto });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Delete automation
router.delete('/form-automation/:id', protect, async (req, res) => {
  try {
    const filter = req.user.role === 'admin'
      ? { _id: req.params.id }
      : { _id: req.params.id, userId: req.user._id };
    const result = await FormAutomation.deleteOne(filter);
    if (!result.deletedCount) return res.status(404).json({ message: 'Automation not found.' });
    res.json({ message: 'Automation deleted.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
