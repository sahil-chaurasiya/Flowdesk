const mongoose = require('mongoose');

/**
 * Explicit, admin-approved link between a Flowdesk record and a record that
 * lives in ANOTHER module's database. Stored in the Flowdesk database in a NEW,
 * additive collection (`identitylinks`) – no existing collection is modified.
 *
 *   kind = 'attendance_user' : flowdeskId = Flowdesk User._id
 *                              externalId = Attendance-DB User._id
 *
 * ObjectIds from different databases are never assumed to correspond; a link
 * is the only thing that says "these two records are the same entity".
 * `externalLabel` is a human-readable snapshot (email / name) for the
 * reconciliation screen only – it is never used for authorization.
 */
const identityLinkSchema = new mongoose.Schema({
  kind: { type: String, enum: ['attendance_user'], required: true },
  flowdeskId: { type: mongoose.Schema.Types.ObjectId, required: true },
  externalId: { type: mongoose.Schema.Types.ObjectId, required: true },
  externalLabel: { type: String, default: '' },
  note: { type: String, default: '', maxlength: 500 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

// one link per Flowdesk record and one per external record, per kind
identityLinkSchema.index({ kind: 1, flowdeskId: 1 }, { unique: true });
identityLinkSchema.index({ kind: 1, externalId: 1 }, { unique: true });

module.exports = mongoose.model('IdentityLink', identityLinkSchema);
