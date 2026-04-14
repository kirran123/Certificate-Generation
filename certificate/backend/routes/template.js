const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Template = require('../models/Template');
const { protect, admin } = require('../middleware/auth');
const axios = require('axios');

const router = express.Router();

// Ensure local upload directories exist
const uploadDir = path.join(__dirname, '../uploads');
const templatesDir = path.join(uploadDir, 'templates');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
if (!fs.existsSync(templatesDir)) fs.mkdirSync(templatesDir, { recursive: true });

// Configure local multer storage
const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, 'uploads/templates/');
  },
  filename(req, file, cb) {
    cb(null, `template-${Date.now()}${path.extname(file.originalname)}`);
  }
});

const uploadLocal = multer({
  storage,
  fileFilter: function (req, file, cb) {
    const filetypes = /jpg|jpeg|png/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Images only! (jpg, jpeg, png)'));
    }
  }
});

// Use local storage for all uploads
router.post('/upload-image', protect, uploadLocal.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }
  // Return local relative path
  res.json({ imageUrl: `/uploads/templates/${req.file.filename}` });
});

router.post('/save-layout', protect, async (req, res) => {
  const { name, imageUrl, layoutConfig, showId, showQr } = req.body;
  try {
    // 1. Convert the template image to Base64 to ensure it persists even if the local file is inaccessible
    let base64Data = '';
    
    if (imageUrl && imageUrl.startsWith('http')) {
       // Fetch from remote URL (Legacy/Cloudinary)
       try {
         const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
         base64Data = Buffer.from(response.data, 'binary').toString('base64');
       } catch (err) {
         console.warn('Failed to fetch remote image for base64 backup:', err.message);
       }
    } else if (imageUrl) {
       // Fetch from local path
       const cleanUrl = imageUrl.replace(/https?:\/\/[^/]+/, '');
       const localPath = path.join(__dirname, '..', cleanUrl);
       if (fs.existsSync(localPath)) {
         const buffer = fs.readFileSync(localPath);
         base64Data = buffer.toString('base64');
       }
    }

    let template;
    const templateData = {
      name,
      imageUrl,
      imageBase64: base64Data,
      layoutConfig,
      showId: showId !== undefined ? showId : true,
      showQr: showQr !== undefined ? showQr : true,
      createdBy: req.user._id
    };

    if (req.body.templateId) {
      // Update existing
      template = await Template.findOneAndUpdate(
        { _id: req.body.templateId, createdBy: req.user._id },
        { $set: templateData },
        { new: true, upsert: true }
      );
    } else {
      // Create new
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
    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }
    res.json(template);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
