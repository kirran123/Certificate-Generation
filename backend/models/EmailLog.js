const mongoose = require('mongoose');

const emailLogSchema = new mongoose.Schema({
  certificateId: { type: String, required: true }, // The generated CERT string
  recipient: { type: String, required: true },
  status: { type: String, enum: ['Sent', 'Failed'], required: true },
  error: { type: String },
  sentAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('EmailLog', emailLogSchema);
