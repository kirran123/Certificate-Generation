const express = require('express');
const { createCloudinaryUpload, cloudinary } = require('../config/cloudinary');
const Template = require('../models/Template');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Upload template image to Cloudinary
router.post('/upload-image', protect, (req, res, next) => {
  const upload = createCloudinaryUpload();
  upload.single('image')(req, res, (err) => {
    if (err) return res.status(400).json({ message: err.message });
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    // Cloudinary returns the permanent URL in req.file.path
    res.json({ imageUrl: req.file.path });
  });
});

// Save template layout (metadata only, auto-uploads image to Cloudinary if not already uploaded)
router.post('/save-layout', protect, async (req, res) => {
  let { name, imageUrl, layoutConfig, showId, showQr } = req.body;
  try {
    // If imageUrl is base64 or not yet on Cloudinary, upload it automatically
    if (imageUrl && !imageUrl.includes('res.cloudinary.com')) {
      try {
        const uploadResult = await cloudinary.uploader.upload(imageUrl, {
          folder: 'digicertify/templates',
          public_id: `template-${Date.now()}-${(name || 'template').replace(/[^a-zA-Z0-9]/g, '_')}`,
        });
        imageUrl = uploadResult.secure_url;
        console.log(`✅ Auto-uploaded template "${name}" to Cloudinary: ${imageUrl}`);
      } catch (uploadErr) {
        console.error('Cloudinary auto-upload failed in save-layout:', uploadErr.message);
      }
    }

    const templateData = {
      name,
      imageUrl,           // Permanent Cloudinary HTTPS URL
      layoutConfig,
      showId: showId !== undefined ? showId : true,
      showQr: showQr !== undefined ? showQr : true,
      createdBy: String(req.user._id),
    };

    let template;
    if (req.body.templateId) {
      // Update existing template
      template = await Template.findOneAndUpdate(
        { _id: req.body.templateId, createdBy: String(req.user._id) },
        { $set: templateData },
        { new: true, upsert: true }
      );
    } else {
      // Create new template
      template = await Template.create(templateData);
    }
    res.status(201).json(template);
  } catch (error) {
    console.error('Save template error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get a single template by ID
router.get('/:id', protect, async (req, res) => {
  try {
    const template = await Template.findById(req.params.id);
    if (!template) return res.status(404).json({ message: 'Template not found' });
    res.json(template);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
