const mongoose = require('mongoose');

const templateSchema = new mongoose.Schema({
  name: { type: String, required: true },
  imageUrl: { type: String, required: true }, // Path to the uploaded base template image
  imageBase64: { type: String }, // Permanent backup of the template image
  layoutConfig: { type: mongoose.Schema.Types.Mixed, required: true }, // x, y, font sizes, colors
  qrCode: { type: Object }, // x, y, width, height
  showId: { type: Boolean, default: true },
  showQr: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Template', templateSchema);
