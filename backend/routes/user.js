const express = require('express');
const Certificate = require('../models/Certificate');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Get certificates for logged-in user
router.get('/my-certificates', protect, async (req, res) => {
  try {
    const email = (req.user.email || '').toLowerCase();
    const userId = String(req.user._id || '');

    const allCerts = await Certificate.find({ isArchived: false });
    let certs = [];

    if (req.user.role === 'admin') {
      certs = allCerts;
    } else {
      certs = allCerts.filter(c => {
        if (!c) return false;
        const cEmail = (c.email || '').toLowerCase();
        const createdById = String(c.createdBy?._id || c.createdBy || '');
        const createdByEmail = String(c.createdBy?.email || '').toLowerCase();
        return (email && cEmail === email) || (userId && createdById === userId) || (email && createdByEmail === email);
      });
    }

    const populated = await Certificate.populate(certs, 'templateId createdBy');
    populated.sort((a, b) => {
      const tA = new Date(a.createdAt || a._creationTime || 0).getTime();
      const tB = new Date(b.createdAt || b._creationTime || 0).getTime();
      return (isNaN(tB) ? 0 : tB) - (isNaN(tA) ? 0 : tA);
    });

    console.log(`[Dashboard] Found ${populated.length} certificates for ${email || userId}`);
    res.json(populated);
  } catch (error) {
    console.error(`[Dashboard Error /my-certificates]:`, error);
    res.status(500).json({ message: error.message });
  }
});

// Get stats for logged-in user
router.get('/stats', protect, async (req, res) => {
  try {
    const email = (req.user.email || '').toLowerCase();
    const userId = String(req.user._id || '');

    const allCerts = await Certificate.find({ isArchived: false });
    
    let allUserCerts = [];
    if (req.user.role === 'admin') {
      allUserCerts = allCerts;
    } else {
      allUserCerts = allCerts.filter(c => {
        if (!c) return false;
        const createdById = String(c.createdBy?._id || c.createdBy || '');
        const createdByEmail = String(c.createdBy?.email || '').toLowerCase();
        return (userId && createdById === userId) || (email && createdByEmail === email);
      });
    }

    const batchSet = new Set(allUserCerts.map(c => c.batchId).filter(Boolean));
    const batchesCount = batchSet.size;
    const sentCount = allUserCerts.filter(c => c.status === 'Sent').length;
    const failedCount = allUserCerts.filter(c => c.status === 'Failed').length;
    const pendingCount = allUserCerts.filter(c => c.status === 'Pending').length;

    const receivedCount = allCerts.filter(c =>
      c.email && c.email.toLowerCase() === email && !c.isArchived
    ).length;

    res.json({ receivedCount, batchesCount, sentCount, failedCount, pendingCount });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
