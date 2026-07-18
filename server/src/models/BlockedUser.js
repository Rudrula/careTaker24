const mongoose = require('mongoose');
const { applyCleanJSON } = require('./_helpers');

// A block is scoped to one circle (someone removed for cause from "Parents
// Care" isn't automatically blocked from a totally unrelated "Pet Care"
// circle the same owner runs). Blocking by email/phone (not just userId)
// matters because the blocked person may not have an account yet — this
// is checked at invite-creation time before a new invitation is even sent.
const blockedUserSchema = new mongoose.Schema({
  careCircleId: { type: mongoose.Schema.Types.ObjectId, ref: 'CareCircle', required: true, index: true },
  blockedUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  blockedEmail: { type: String, default: null, lowercase: true, trim: true },
  blockedPhone: { type: String, default: null, trim: true },
  blockedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reason: { type: String, default: '' },
}, { timestamps: true });

blockedUserSchema.index({ careCircleId: 1, blockedUserId: 1 });
blockedUserSchema.index({ careCircleId: 1, blockedEmail: 1 });
blockedUserSchema.index({ careCircleId: 1, blockedPhone: 1 });

applyCleanJSON(blockedUserSchema);

module.exports = mongoose.model('BlockedUser', blockedUserSchema);
