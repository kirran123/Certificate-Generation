const express = require('express');
const router = express.Router();
const Feedback = require('../models/Feedback');
const auth = require('../middleware/auth');

// @route GET /api/user-feedback/test
router.get('/test', (req, res) => {
  res.json({ message: 'Feedback Router is online and reachable' });
});

// @route POST /api/user-feedback
router.post('/', async (req, res) => {
  try {
    const { name, email, message, certificateId, type } = req.body;
    if (!name || !message) {
      return res.status(400).json({ message: 'Name and message are required' });
    }
    const feedback = await Feedback.create({ name, email, type: type || 'Suggestion', message, certificateId });
    res.json({ message: 'Feedback submitted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server Error', details: err.message });
  }
});

// @route GET /api/user-feedback/admin
router.get('/admin', auth.protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Access denied' });
    const feedbacks = await Feedback.find({});
    res.json(feedbacks);
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
});

// @route DELETE /api/user-feedback/admin/:id
router.delete('/admin/:id', auth.protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Access denied' });
    await Feedback.deleteOne(req.params.id);
    res.json({ message: 'Feedback deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
});

module.exports = router;
