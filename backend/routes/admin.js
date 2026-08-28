const express = require('express');
const User = require('../models/User');
const Certificate = require('../models/Certificate');
const EmailLog = require('../models/EmailLog');
const Feedback = require('../models/Feedback');
const { protect, admin } = require('../middleware/auth');
const { getBrevoPoolStatus } = require('../utils/brevoPool');
const { getOrFetch, clearCache } = require('../utils/cache');

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

// Get overview stats (Cached for 15 seconds)
router.get('/stats', async (req, res) => {
  try {
    const statsData = await getOrFetch('admin_stats', 15000, async () => {
      const usersCount = await User.countDocuments();
      const allCerts = await Certificate.find({ isArchived: { $ne: true } });
      const certificatesCount = allCerts.length;
      const sentCount = allCerts.filter(c => c.status === 'Sent').length;
      const failedCount = allCerts.filter(c => c.status === 'Failed').length;
      const recentLogs = await EmailLog.find({ limit: 20 });
      const recentFeedbacks = await Feedback.find({ limit: 10 });

      return {
        usersCount,
        certificatesCount,
        sentCount,
        failedCount,
        recentLogs,
        recentFeedbacks,
      };
    });

    res.json(statsData);
  } catch (error) {
    console.error('Error in /api/admin/stats:', error.message);
    res.status(200).json({
      usersCount: 0,
      certificatesCount: 0,
      sentCount: 0,
      failedCount: 0,
      recentLogs: [],
      recentFeedbacks: [],
      error: error.message
    });
  }
});

// Get all users (Cached for 15 seconds)
router.get('/users', async (req, res) => {
  try {
    const users = await getOrFetch('admin_users', 15000, async () => {
      return await User.find({});
    });
    res.json(users);
  } catch (error) {
    console.error('Error in /api/admin/users:', error.message);
    res.json([]);
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
      clearCache('admin_users');
      clearCache('admin_stats');
      res.json({ message: 'User removed' });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get all certificates (Cached for 15 seconds)
router.get('/certificates', async (req, res) => {
  try {
    const certsData = await getOrFetch('admin_certificates', 15000, async () => {
      const certs = await Certificate.find({ isArchived: { $ne: true } });
      return await Certificate.populate(certs, 'templateId createdBy');
    });
    res.json(certsData);
  } catch (error) {
    console.error('Error in /api/admin/certificates:', error.message);
    res.json([]);
  }
});

// Delete certificate
router.delete('/certificates/:id', async (req, res) => {
  try {
    const cert = await Certificate.findByDocId(req.params.id);
    if (cert) {
      await Certificate.deleteOne({ certificateId: cert.certificateId });
      clearCache('admin_certificates');
      clearCache('admin_stats');
      res.json({ message: 'Certificate removed' });
    } else {
      res.status(404).json({ message: 'Certificate not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get email logs (Cached for 15 seconds)
router.get('/emaillogs', async (req, res) => {
  try {
    const logs = await getOrFetch('admin_emaillogs', 15000, async () => {
      return await EmailLog.find({ limit: 100 });
    });
    res.json(logs);
  } catch (error) {
    console.error('Error in /api/admin/emaillogs:', error.message);
    res.json([]);
  }
});

module.exports = router;
