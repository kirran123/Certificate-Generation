const express = require('express');
const Certificate = require('../models/Certificate');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Get certificates for logged-in user (both received and generated)
router.get('/my-certificates', protect, async (req, res) => {
  try {
    const email = req.user.email;
    console.log(`[Dashboard] Fetching certificates for: ${email}`);
    
    const certs = await Certificate.find({ 
      isArchived: { $ne: true },
      $or: [
        { email: { $regex: new RegExp(`^${email}$`, 'i') } },
        { createdBy: req.user._id }
      ]
    })
    .populate('templateId', 'name')
    .sort({ createdAt: -1 });
    
    console.log(`[Dashboard] Found ${certs.length} relevant certificates for ${email}`);
    res.json(certs);
  } catch (error) {
    console.error(`[Dashboard Error] Failed to fetch user certs for ${req.user?.email}:`, error);
    res.status(500).json({ message: error.message });
  }
});

// Get stats for logged-in user
router.get('/stats', protect, async (req, res) => {
  try {
    const email = req.user.email;
    const userId = req.user._id;

    const receivedCount = await Certificate.countDocuments({
      email: { $regex: new RegExp(`^${email}$`, 'i') },
      isArchived: { $ne: true }
    });

    const distinctBatches = await Certificate.distinct('batchId', {
      createdBy: userId,
      batchId: { $exists: true, $ne: null }
    });
    const batchesCount = distinctBatches.length;

    const sentCount = await Certificate.countDocuments({
      createdBy: userId,
      status: 'Sent',
      isArchived: { $ne: true }
    });

    const failedCount = await Certificate.countDocuments({
      createdBy: userId,
      status: 'Failed',
      isArchived: { $ne: true }
    });

    const pendingCount = await Certificate.countDocuments({
      createdBy: userId,
      status: 'Pending',
      isArchived: { $ne: true }
    });

    res.json({
      receivedCount,
      batchesCount,
      sentCount,
      failedCount,
      pendingCount
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
