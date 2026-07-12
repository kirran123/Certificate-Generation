const express = require('express');
const router = express.Router();
const Feedback = require('../models/Feedback');
const auth = require('../middleware/auth');

// @route GET /api/user-feedback/test
// @desc Verify connectivity
// @access Public
router.get('/test', (req, res) => {
  res.json({ message: 'Feedback Router is online and reachable' });
});

// @route POST /api/user-feedback
// @desc Submit feedback from public verify page
// @access Public
router.post('/', async (req, res) => {
  try {
    console.log('Feedback Received:', req.body);
    const { name, email, message, certificateId, type } = req.body;
    if (!name || !message) {
      console.warn('Feedback rejected: Missing name or message');
      return res.status(400).json({ message: 'Name and message are required' });
    }

    const newFeedback = new Feedback({
      name,
      email,
      type: type || 'Suggestion',
      message,
      certificateId
    });

    await newFeedback.save();
    console.log('Feedback saved successfully');
    res.json({ message: 'Feedback submitted successfully' });
  } catch (err) {
    console.error('Feedback Database Error:', err);
    res.status(500).json({ 
      message: 'Server Error', 
      details: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined 
    });
  }
});

// @route GET /api/feedback/admin
// @desc Get all feedback for admin
// @access Admin Only
router.get('/admin', auth.protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const feedbacks = await Feedback.find().sort({ createdAt: -1 });
    res.json(feedbacks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @route DELETE /api/feedback/admin/:id
// @desc Delete feedback
// @access Admin Only
router.delete('/admin/:id', auth.protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    await Feedback.findByIdAndDelete(req.params.id);
    res.json({ message: 'Feedback deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error' });
  }
});

module.exports = router;
