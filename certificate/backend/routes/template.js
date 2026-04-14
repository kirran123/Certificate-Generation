const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Template = require('../models/Template');
const { protect, admin } = require('../middleware/auth');

const router = express.Router();

// Ensure upload directories exist
const uploadDir = path.join(__dirname, '../uploads');
const templatesDir = path.join(uploadDir, 'templates');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
if (!fs.existsSync(templatesDir)) fs.mkdirSync(templatesDir);

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, 'uploads/templates/');
  },
  filename(req, file, cb) {
    cb(null, `template-${Date.now()}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
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

router.post('/upload-image', protect, upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }
  // Return the path so frontend can display it in the designer
  res.json({ imageUrl: `/${req.file.path.replace(/\\\\/g, '/')}` }); // normalize slashes
});

router.post('/save-layout', protect, async (req, res) => {
  const { name, imageUrl, layoutConfig } = req.body;
  try {
    const template = await Template.create({
      name,
      imageUrl,
      layoutConfig,
      createdBy: req.user._id
    });
    res.status(201).json(template);
  } catch (error) {
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
