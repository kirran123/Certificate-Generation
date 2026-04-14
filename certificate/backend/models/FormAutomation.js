const mongoose = require('mongoose');

const formAutomationSchema = new mongoose.Schema({
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  templateId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Template', required: true },
  sheetUrl:    { type: String, required: true },   // raw URL pasted by user
  sheetId:     { type: String, required: true },   // extracted spreadsheet ID
  gid:         { type: String, default: '0' },     // sheet tab id (gid)
  nameColumn:  { type: String, required: true },   // column header that maps to recipient name
  emailColumn: { type: String, required: true },   // column header that maps to email
  batchId:     { type: String, required: true },   // e.g. "Form Auto - 12/04/2026"
  active:      { type: Boolean, default: true },
  lastChecked: { type: Date, default: null },
  certCount:   { type: Number, default: 0 }        // total auto-generated so far
}, { timestamps: true });

module.exports = mongoose.model('FormAutomation', formAutomationSchema);
