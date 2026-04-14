const express = require('express');
const Certificate = require('../models/Certificate');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Get certificates for logged-in user (both received and generated)
router.get('/my-certificates', protect, async (req, res) => {
  try {
    const certs = await Certificate.find({ 
      $or: [
        { email: { $regex: new RegExp(`^${req.user.email}$`, 'i') } },
        { createdBy: req.user._id }
      ]
    })
    .populate('templateId', 'name')
    .sort({ createdAt: -1 });
    
    res.json(certs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
