const mongoose = require('mongoose');

const certificateSchema = new mongoose.Schema({
  certificateId: { type: String, required: true, unique: true }, // Format: CERT + 6 digits
  name: { type: String, required: true },
  email: { type: String }, // Optional, for sending email
  course: { type: String }, // Optional depending on template
  date: { type: Date, default: Date.now },
  templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Template' },
  pdfUrl: { type: String }, // Path to the generated PDF
  status: { type: String, enum: ['Pending', 'Sent', 'Failed'], default: 'Pending' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  batchId: { type: String },
  automationId: { type: mongoose.Schema.Types.ObjectId, ref: 'FormAutomation' },
  isAutomation: { type: Boolean, default: false },
  uniqueHash: { type: String },
  metadata: { type: mongoose.Schema.Types.Mixed }
}, { timestamps: true });

certificateSchema.index({ createdBy: 1, isArchived: 1 });
certificateSchema.index({ batchId: 1 });
certificateSchema.index({ status: 1 });
certificateSchema.index({ email: 1 });
certificateSchema.index({ uniqueHash: 1 });
certificateSchema.index({ isArchived: 1 });

module.exports = mongoose.model('Certificate', certificateSchema);
