const mongoose = require('mongoose');

// ── Note sub-document ─────────────────────────────────────────────────────────
const noteSchema = new mongoose.Schema({
  body:      { type: String, required: true, trim: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

// ── Activity log sub-document ─────────────────────────────────────────────────
const activitySchema = new mongoose.Schema({
  // Core action type — covers CRM sales activity tracking
  action: {
    type: String,
    required: true,
    enum: [
      // Stage transitions
      'moved', 'created',
      // Sales activities (new)
      'call_made',
      'whatsapp_sent',
      'email_sent',
      'meeting_scheduled',
      'meeting_completed',
      'proposal_sent',
      'proposal_viewed',
      'follow_up_done',
      'follow_up_set',
      // Notes & misc
      'note_added',
    ],
  },
  fromStage: { type: String },
  toStage:   { type: String },
  by:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  note:      { type: String }, // optional context / description
}, { timestamps: true });

// ── Main InternalLead schema ──────────────────────────────────────────────────
const internalLeadSchema = new mongoose.Schema({
  // ── Identity ──────────────────────────────────────────────────────────────
  name:    { type: String, trim: true },
  email:   { type: String, trim: true, lowercase: true },
  phone:   { type: String, trim: true },
  company: { type: String, trim: true },
  website: { type: String, trim: true },
  location:{ type: String, trim: true },

  // ── Lead Origin ───────────────────────────────────────────────────────────
  source: {
    type: String,
    enum: ['referral', 'linkedin', 'facebook', 'instagram', 'cold_outreach', 'website', 'walk_in', 'other'],
    default: 'other',
  },
  sourceDetail: { type: String, trim: true },

  // ── Business info ─────────────────────────────────────────────────────────
  budget:       { type: String, trim: true },
  services:     [{ type: String, trim: true }],
  requirements: { type: String, trim: true },

  // ── Pipeline stage (Kanban columns) ──────────────────────────────────────
  stage: {
    type: String,
    enum: ['new', 'contacted', 'meeting_scheduled', 'proposal_sent', 'negotiation', 'won', 'lost'],
    default: 'new',
  },

  // ── Quality / priority ────────────────────────────────────────────────────
  quality: {
    type: String,
    enum: ['hot', 'warm', 'cold'],
    default: 'warm',
  },

  // ── Follow-up scheduling ──────────────────────────────────────────────────
  followUpDate: { type: Date, default: null },
  followUpNote: { type: String, trim: true },

  // ── Ownership ────────────────────────────────────────────────────────────
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  createdBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // ── Notes & history ───────────────────────────────────────────────────────
  notes:    [noteSchema],
  activity: [activitySchema],

  // ── Closed reason ─────────────────────────────────────────────────────────
  closedReason: { type: String, trim: true },

  // ── Deal value (optional) ─────────────────────────────────────────────────
  dealValue: { type: Number, default: 0 },

  // ── Tags ──────────────────────────────────────────────────────────────────
  tags: [{ type: String, trim: true }],
}, {
  timestamps: true,
});

// Indexes for fast queries
internalLeadSchema.index({ stage: 1, followUpDate: 1 });
internalLeadSchema.index({ createdBy: 1, createdAt: -1 });
internalLeadSchema.index({ followUpDate: 1 });
internalLeadSchema.index({ assignedTo: 1 });

module.exports = mongoose.model('InternalLead', internalLeadSchema);
