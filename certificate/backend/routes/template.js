const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Template = require('../models/Template');
const { protect, admin } = require('../middleware/auth');

const { uploadCloudinary } = require('../utils/cloudinaryConfig');
const axios = require('axios');

const router = express.Router();

// Ensure local upload directories exist (keep for fallback/other uses)
const uploadDir = path.join(__dirname, '../uploads');
const templatesDir = path.join(uploadDir, 'templates');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
if (!fs.existsSync(templatesDir)) fs.mkdirSync(templatesDir);

// Configure local multer for legacy support or non-Cloudinary uses
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

// Update upload-image to use Cloudinary
router.post('/upload-image', protect, uploadCloudinary.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }
  // Cloudinary returns the full https URL in req.file.path
  res.json({ imageUrl: req.file.path });
});

router.post('/save-layout', protect, async (req, res) => {
  const { name, imageUrl, layoutConfig, showId, showQr } = req.body;
  try {
    // 1. Convert the template image to Base64 to ensure it persists even if the local file or Cloudinary is inaccessible
    let base64Data = '';
    
    if (imageUrl.startsWith('http')) {
       // Fetch from remote URL (Cloudinary)
       try {
         const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
         base64Data = Buffer.from(response.data, 'binary').toString('base64');
       } catch (err) {
         console.warn('Failed to fetch remote image for base64 backup:', err.message);
       }
    } else {
       // Fetch from local path
       const cleanUrl = imageUrl.replace(/https?:\/\/[^/]+/, '');
       const localPath = path.join(__dirname, '..', cleanUrl);
       if (fs.existsSync(localPath)) {
         const buffer = fs.readFileSync(localPath);
         base64Data = buffer.toString('base64');
       }
    }

    const template = await Template.create({
      name,
      imageUrl,
      imageBase64: base64Data,
      layoutConfig,
      showId: showId !== undefined ? showId : true,
      showQr: showQr !== undefined ? showQr : true,
      createdBy: req.user._id
    });
    res.status(201).json(template);
  } catch (error) {
    console.error('Save template error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get all templates
router.get('/', protect, async (req, res) => {
  try {
    const templates = await Template.find({});
    res.json(templates);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
