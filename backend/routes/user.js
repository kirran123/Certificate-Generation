const express = require('express');
const Certificate = require('../models/Certificate');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Get certificates for logged-in user
router.get('/my-certificates', protect, async (req, res) => {
  try {
    const email = req.user.email;
    const userId = String(req.user._id);

    // Get by createdBy
    const byUser = await Certificate.find({ createdBy: userId, isArchived: false });
    // Get by email match
    const byEmail = await Certificate.find({});
    const byEmailFiltered = byEmail.filter(c =>
      c.email && c.email.toLowerCase() === email.toLowerCase() && !c.isArchived
    );

    // Merge, deduplicate by _id
    const merged = [...byUser];
    for (const c of byEmailFiltered) {
      if (!merged.find(m => m._id === c._id)) merged.push(c);
    }

    // Populate template name
    const populated = await Certificate.populate(merged, 'templateId');
    // Sort by createdAt desc
    populated.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    console.log(`[Dashboard] Found ${populated.length} certificates for ${email}`);
    res.json(populated);
  } catch (error) {
    console.error(`[Dashboard Error]:`, error);
    res.status(500).json({ message: error.message });
  }
});

// Get stats for logged-in user
router.get('/stats', protect, async (req, res) => {
  try {
    const email = req.user.email;
    const userId = String(req.user._id);

    const allUserCerts = await Certificate.find({ createdBy: userId, isArchived: false });

    const batchSet = new Set(allUserCerts.map(c => c.batchId).filter(Boolean));
    const batchesCount = batchSet.size;
    const sentCount = allUserCerts.filter(c => c.status === 'Sent').length;
    const failedCount = allUserCerts.filter(c => c.status === 'Failed').length;
    const pendingCount = allUserCerts.filter(c => c.status === 'Pending').length;

    const allCerts = await Certificate.find({});
    const receivedCount = allCerts.filter(c =>
      c.email && c.email.toLowerCase() === email.toLowerCase() && !c.isArchived
    ).length;

    res.json({ receivedCount, batchesCount, sentCount, failedCount, pendingCount });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
