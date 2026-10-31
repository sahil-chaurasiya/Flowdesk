const mongoose = require('mongoose');
const { bindModel } = require('../../../config/connections');

// A person hired on a per-job basis (photographer, video editor, designer, ...).
// Unlike an Employee there is no monthly salary — what they earn is decided job
// by job (see FreelancerJob) and what we actually paid them is tracked as
// FreelancerPayment records.
const freelancerSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  // What they do — free text so any skill can be added (Photographer, Editor, ...).
  role: { type: String, default: '', trim: true },
  phone: { type: String, default: '', trim: true },
  email: { type: String, default: '', trim: true, lowercase: true },
  city: { type: String, default: '', trim: true },
  // Where to send the money.
  upiId: { type: String, default: '', trim: true },
  bankDetails: { type: String, default: '' },
  notes: { type: String, default: '' },
  // Inactive = not currently working with us. History is always kept.
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = bindModel('finance', 'Freelancer', freelancerSchema);