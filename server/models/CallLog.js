const mongoose = require('mongoose');

// ── CallLog schema ─────────────────────────────────────────────────────────────
// Tracks outbound prospecting calls made by the performance marketer
// BEFORE a lead is created — this is the cold-calling / discovery phase.
const callLogSchema = new mongoose.Schema(
  {
    // Who made the call
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // Prospect details (not yet a lead)
    prospectName:    { type: String, trim: true, default: '' },
    prospectPhone:   { type: String, trim: true, default: '' },
    prospectCompany: { type: String, trim: true, default: '' },

    // Call metadata
    callDate: { type: Date, required: true, default: Date.now },

    duration: {
      type: Number, // seconds
      default: 0,
      min: 0,
    },

    callType: {
      type: String,
      enum: ['cold_call', 'follow_up', 'discovery', 'whatsapp', 'other'],
      default: 'cold_call',
    },

    outcome: {
      type: String,
      enum: [
        'no_answer',
        'not_interested',
        'callback_requested',
        'interested',
        'converted_to_lead',
        'wrong_number',
        'voicemail',
      ],
      required: true,
    },

    // Did this call result in a lead being created?
    convertedToLead: { type: Boolean, default: false },
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InternalLead',
      default: null,
    },

    // Notes from the call
    notes: { type: String, trim: true, default: '' },

    // Prospect source / platform
    prospectSource: {
      type: String,
      enum: ['linkedin', 'facebook', 'instagram', 'cold_list', 'referral', 'website', 'other'],
      default: 'other',
    },
  },
  { timestamps: true }
);

// Fast lookups
callLogSchema.index({ performedBy: 1, callDate: -1 });
callLogSchema.index({ callDate: -1 });
callLogSchema.index({ outcome: 1 });

module.exports = mongoose.model('CallLog', callLogSchema);
