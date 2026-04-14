const express = require('express');
const Certificate = require('../models/Certificate');

const router = express.Router();

// Public route to verify a certificate
router.get('/:id', async (req, res) => {
  try {
    const cert = await Certificate.findOne({ certificateId: req.params.id })
      .populate('templateId', 'name');
      
    if (!cert) {
      return res.status(404).json({ valid: false, message: 'Certificate not found or invalid' });
    }

    res.json({
      valid: true,
      certificate: {
        certificateId: cert.certificateId,
        name: cert.name,
        course: cert.course,
        date: cert.date,
        templateName: cert.templateId?.name,
        status: cert.status,
        pdfUrl: cert.pdfUrl // They can download the PDF
      }
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
