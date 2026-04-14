const express = require('express');
const User = require('../models/User');
const Certificate = require('../models/Certificate');
const EmailLog = require('../models/EmailLog');
const { protect, admin } = require('../middleware/auth');

const router = express.Router();

// All routes here are protected and admin-only
router.use(protect, admin);

// Get all users
router.get('/users', async (req, res) => {
  try {
    const users = await User.find({}).select('-password');
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
      await user.deleteOne();
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
    const certs = await Certificate.find({}).populate('templateId', 'name').populate('createdBy', 'name email');
    res.json(certs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete certificate
router.delete('/certificates/:id', async (req, res) => {
  try {
    const cert = await Certificate.findById(req.params.id);
    if (cert) {
      await cert.deleteOne();
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
    const logs = await EmailLog.find({}).sort({ sentAt: -1 });
    res.json(logs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
