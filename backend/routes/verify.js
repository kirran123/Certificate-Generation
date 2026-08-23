const express = require('express');
const Certificate = require('../models/Certificate');

const router = express.Router();

// Public route to verify a certificate by ID
router.get('/:id', async (req, res) => {
  try {
    const cert = await Certificate.findOne({ certificateId: req.params.id });
    if (!cert) {
      return res.status(404).json({ valid: false, message: 'Certificate not found or invalid' });
    }

    // Populate template name
    const Template = require('../models/Template');
    let templateName = null;
    if (cert.templateId) {
      const tmpl = await Template.findById(cert.templateId);
      templateName = tmpl ? tmpl.name : null;
    }

    res.json({
      valid: true,
      certificate: {
        certificateId: cert.certificateId,
        name: cert.name,
        course: cert.course,
        date: cert.createdAt || cert.date,
        templateName,
        status: cert.status,
        pdfUrl: cert.pdfUrl,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
