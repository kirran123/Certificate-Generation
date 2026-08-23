const express = require('express');
const User = require('../models/User');
const Certificate = require('../models/Certificate');
const EmailLog = require('../models/EmailLog');
const Feedback = require('../models/Feedback');
const { protect, admin } = require('../middleware/auth');
const { getBrevoPoolStatus } = require('../utils/brevoPool');

const router = express.Router();

// Get Brevo API Keys pool status (public diagnostic monitoring)
router.get('/brevo-status', async (req, res) => {
  try {
    const status = await getBrevoPoolStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// All other routes here are protected and admin-only
router.use(protect, admin);

// Get overview stats
router.get('/stats', async (req, res) => {
  try {
    const usersCount = await User.countDocuments();
    
    const allCerts = await Certificate.find({ isArchived: { $ne: true } });
    const certificatesCount = allCerts.length;
    const sentCount = allCerts.filter(c => c.status === 'Sent').length;
    const failedCount = allCerts.filter(c => c.status === 'Failed').length;

    const recentLogs = await EmailLog.find({});
    const recentFeedbacks = await Feedback.find({});

    res.json({
      usersCount,
      certificatesCount,
      sentCount,
      failedCount,
      recentLogs: recentLogs.slice(0, 20),
      recentFeedbacks: recentFeedbacks.slice(0, 10),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get all users
router.get('/users', async (req, res) => {
  try {
    const users = await User.find({});
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete user
router.delete('/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (user) {
      if (user.role === 'admin') {
        return res.status(400).json({ message: 'Cannot delete the admin account' });
      }
      await User.deleteOne(req.params.id);
      res.json({ message: 'User removed' });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get all certificates
router.get('/certificates', async (req, res) => {
  try {
    const certs = await Certificate.find({ isArchived: { $ne: true } });
    // Populate template and user info
    const populated = await Certificate.populate(certs, 'templateId');
    res.json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete certificate
router.delete('/certificates/:id', async (req, res) => {
  try {
    const cert = await Certificate.findByDocId(req.params.id);
    if (cert) {
      await Certificate.deleteOne({ certificateId: cert.certificateId });
      res.json({ message: 'Certificate removed' });
    } else {
      res.status(404).json({ message: 'Certificate not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get email logs
router.get('/emaillogs', async (req, res) => {
  try {
    const logs = await EmailLog.find({});
    res.json(logs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
