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

  // ── Handle Google Forms URL (forms.google.com) ─────────────────────────
  // Google Forms don't have a direct CSV export; user needs the linked Sheet
  if (sheetUrl.includes('docs.google.com/forms') || sheetUrl.includes('forms.gle')) {
    return res.status(400).json({
      message: 'This looks like a Google Form URL. Please open the form responses in Google Sheets (click the Sheets icon in the form), then paste that Sheets link here.'
    });
  }

  // ── Extract spreadsheet ID ─────────────────────────────────────────────
  const idMatch = sheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (!idMatch) {
    return res.status(400).json({ message: 'Invalid Google Sheets URL. Please copy the URL from the browser address bar while the sheet is open.' });
  }

  const docId = sheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/)[1];

  // Extract gid — handles both #gid= and &gid= variants
  const gidMatch = sheetUrl.match(/[#&?]gid=([0-9]+)/);
  const preferredGid = gidMatch ? gidMatch[1] : null;

  // Try preferred gid, then 0, 1, 2 as fallbacks
  const gidsToTry = preferredGid
    ? [preferredGid, '0', '1', '2']
    : ['0', '1', '2'];

  // Helper: fetch + parse one gid
  const tryFetchGid = async (gid) => {
    const exportUrl = `https://docs.google.com/spreadsheets/d/${docId}/export?format=csv&gid=${gid}`;
    const response = await axios.get(exportUrl, {
      responseType: 'arraybuffer',
      timeout: 15000,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    // Detect redirect to login page (sheet is private)
    const text = Buffer.from(response.data).toString('utf8', 0, 200);
    if (text.includes('<html') && (text.includes('accounts.google.com') || text.includes('ServiceLogin'))) {
      throw new Error('PRIVATE');
    }

    const workbook = xlsx.read(response.data, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const ws = workbook.Sheets[sheetName];

    // Get the range to detect if there are any cells at all
    const range = xlsx.utils.decode_range(ws['!ref'] || 'A1:A1');
    const totalRows = range.e.r; // 0-indexed, so 0 means only header row

    // Parse with raw:false and defval to handle empty cells and date formatting
    const data = xlsx.utils.sheet_to_json(ws, { raw: false, defval: '' });
    const headers = xlsx.utils.sheet_to_json(ws, { header: 1, raw: false })[0] || [];

    return { data, headers, totalRows };
  };

  try {
    let lastError = null;
    let result = null;

    for (const gid of [...new Set(gidsToTry)]) {
      try {
        const r = await tryFetchGid(gid);

        // If headers found, consider it a valid sheet even with 0 data rows
        if (r.headers && r.headers.length > 0) {
          result = r;
          result.gidUsed = gid;
          break;
        }
      } catch (e) {
        if (e.message === 'PRIVATE') {
          return res.status(403).json({
            message: 'This Google Sheet is private. Go to Share → "Anyone with the link" → Viewer, then try again.'
          });
        }
        lastError = e;
      }
    }

    if (!result) {
      throw lastError || new Error('Could not read any sheet tab.');
    }

    // If data rows are 0 but headers exist, respond with empty data + headers
    // so the frontend can still show column pickers for auto-cert setup
    if (result.data.length === 0) {
      console.log(`[Sheet] Sheet "${docId}" gid=${result.gidUsed} has headers but no data rows yet.`);
      return res.json({
        data: [],
        headers: result.headers.map(String).filter(Boolean),
        warning: 'The sheet has column headers but no data rows yet. Auto-cert will generate certificates as new rows are added.'
      });
    }

    res.json({
      data: result.data,
      headers: result.headers.map(String).filter(Boolean)
    });

  } catch (err) {
    console.error('[Sheet Sync Error]', err.message);

    let message = 'Failed to access the Google Sheet.';
    if (err.response?.status === 401 || err.response?.status === 403) {
      message = 'Access denied. Set the sheet sharing to "Anyone with the link can view".';
    } else if (err.response?.status === 404) {
      message = 'Sheet not found. Check the URL is correct.';
    } else if (err.code === 'ECONNABORTED') {
      message = 'Request timed out. The sheet may be very large or Google servers are slow.';
    }

    res.status(500).json({ message, error: err.message });
  }
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
      } catch(e) { template = null; }
    }

    if (!template || !template.imageUrl) {
      return res.status(400).json({ message: 'No template image detected. Please upload an image first.' });
    }

    const cleanUrl = getRelativePath(template.imageUrl);
    const templatePath = path.join(__dirname, '..', cleanUrl);
    
    if (!fs.existsSync(templatePath)) {
      console.error('File not found at:', templatePath);
      return res.status(404).json({ message: `Template image file not found on server: ${cleanUrl}` });
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
    
    const certsDir = path.join(__dirname, '../uploads/certificates');
    if (!fs.existsSync(certsDir)) fs.mkdirSync(certsDir, { recursive: true });

    let generatedCount = 0;
    let skippedCount = 0;
    const generatedIds = [];
    
    // Ensure we have a valid batch ID
    const timestamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
    const batchId = req.body.batchId || `Batch ${timestamp}`;

    for (const row of rawData) {
      // Build mapped item data
      const itemData = {};
      Object.keys(mappings || {}).forEach(key => {
        const sourceHeader = mappings[key];
        let value = row[sourceHeader] || '';
        
        // Normalize email
        if (key === 'email' && typeof value === 'string') {
          value = value.trim().toLowerCase();
        }
        
        itemData[key] = value;
      });

      // Extract metadata (everything mapped but not core name/email/course)
      const metadata = {};
      Object.keys(mappings || {}).forEach(key => {
        if (!['name', 'email', 'course'].includes(key)) {
          metadata[key] = String(row[mappings[key]] || '');
        }
      });

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
          course: String(itemData.course || ''),
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

// Send bulk emails
router.post('/send-bulk', protect, async (req, res) => {
  const { certificateIds, subject, message, senderName, senderEmail } = req.body;
  
  // Create transporter
  const brevoApiKey = process.env.BREVO_API_KEY;

  try {
    const certs = await Certificate.find({ certificateId: { $in: certificateIds } });
    
    let sentCount = 0;
    for (const cert of certs) {
      if (!cert.email) continue;
      
      const pdfPath = path.join(__dirname, '..', cert.pdfUrl);
      
      try {
        if (!fs.existsSync(pdfPath)) {
            throw new Error(`PDF not found on server (likely cleared by a recent app deployment). Please regenerate this certificate batch.`);
        }

        const pdfBuffer = fs.readFileSync(pdfPath);
        const base64Pdf = pdfBuffer.toString('base64');

        const senderEmailFinal = senderEmail || 'digicertify00@gmail.com';
        const senderNameFinal = senderName || 'DigiCertify';

        const brevoPayload = {
          sender: { name: senderNameFinal, email: senderEmailFinal },
          to: [{ email: cert.email }],
          subject: subject || 'Your Certificate of Achievement',
          htmlContent: `
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
          `,
          attachment: [
            {
              content: base64Pdf,
              name: `${cert.certificateId}.pdf`
            }
          ]
        };

        const response = await axios.post('https://api.brevo.com/v3/smtp/email', brevoPayload, {
            headers: {
                'api-key': brevoApiKey,
                'Content-Type': 'application/json'
            }
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

// Download bulk certificates as ZIP
router.get('/download-bulk', protect, async (req, res) => {
  try {
    const filter = req.user.role === 'admin' ? {} : { createdBy: req.user._id };
    const certs = await Certificate.find(filter);
    
    if (certs.length === 0) {
      return res.status(404).json({ message: 'No certificates found' });
    }

    res.attachment('certificates.zip');
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(res);

    for (const cert of certs) {
      // Determine folder name (Batch Name)
      let batchFolderName = cert.batchId || 'Manual Generations';
      
      // Sanitize folder name for file system safety
      batchFolderName = batchFolderName.replace(/[<>:"/\\|?*]/g, '_').trim();

      const pdfPath = path.join(__dirname, '..', cert.pdfUrl);
      if (fs.existsSync(pdfPath)) {
        // Add to ZIP within the batch folder
        archive.file(pdfPath, { name: `${batchFolderName}/${cert.certificateId}.pdf` });
      }
    }

    archive.finalize();
  } catch (error) {
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

// Get certificates generated BY the logged-in user
router.get('/my-generations', protect, async (req, res) => {
  try {
    const certs = await Certificate.find({ 
      $or: [
        { createdBy: req.user._id },
        { createdBy: { $exists: false } }
      ]
    }).populate('templateId', 'name').populate('createdBy', 'name email');
    res.json(certs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ── Form Automation Routes ─────────────────────────────────────────────────

// Create a new form automation
router.post('/form-automation', protect, async (req, res) => {
  const { sheetUrl, templateId, nameColumn, emailColumn, batchId } = req.body;
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
    // Check for existing automation for the same sheet + user
    const existing = await FormAutomation.findOne({ sheetId, userId: req.user._id });
    if (existing) {
      // Update it instead
      existing.templateId  = templateId;
      existing.nameColumn  = nameColumn;
      existing.emailColumn = emailColumn;
      existing.batchId     = finalBatchId;
      existing.sheetUrl    = sheetUrl;
      existing.gid         = gid;
      existing.active      = true;
      await existing.save();
      return res.json({ message: 'Automation updated.', automation: existing });
    }

    const automation = await FormAutomation.create({
      userId:      req.user._id,
      templateId,
      sheetUrl,
      sheetId,
      gid,
      nameColumn,
      emailColumn,
      batchId:     finalBatchId
    });
    res.status(201).json({ message: 'Automation created. Poller will check every 10 seconds.', automation });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// List all automations for current user
router.get('/form-automations', protect, async (req, res) => {
  try {
    const filter = req.user.role === 'admin' ? {} : { userId: req.user._id };
    const list = await FormAutomation.find(filter)
      .populate('templateId', 'name')
      .populate('userId', 'name email');
    res.json(list);
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
