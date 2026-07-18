const mongoose = require('mongoose');
const { applyCleanJSON } = require('./_helpers');

// Every step notifies exactly one target, then waits `waitMinutes` for a
// response (the medicine being marked taken/skipped, or the step being
// explicitly acknowledged) before moving on. `target` can point at either
// a Care Circle member (the son, the daughter — people already in the
// circle) or a plain Contact (the family doctor — who has a phone number
// on file but isn't a circle member, so pushes can't reach them, only the
// contactDelivery service's SMS/call channel can).
const TARGET_TYPES = ['member', 'contact'];

const escalationStepSchema = new mongoose.Schema({
  order: { type: Number, required: true },
  targetType: { type: String, enum: TARGET_TYPES, required: true },
  targetId: { type: mongoose.Schema.Types.ObjectId, required: true }, // User._id (member) or Contact._id
  label: { type: String, required: true, trim: true }, // denormalized display name — "Wife", "Son", "Dr. Mehta" — survives the member/contact being renamed or removed later
  waitMinutes: { type: Number, default: 15, min: 1, max: 1440 },
}, { _id: false });

const escalationPolicySchema = new mongoose.Schema({
  familyId: { type: mongoose.Schema.Types.ObjectId, ref: 'CareCircle', required: true, unique: true, index: true },
  enabled: { type: Boolean, default: false },

  // Phase 1 — repeat the plain "time for your medicine" reminder to the
  // senior themselves before escalating to anyone else. Matches "Reminder
  // 1 / Reminder 2 / Reminder 3" in the brief.
  reminderRepeatCount: { type: Number, default: 3, min: 0, max: 10 },
  reminderIntervalMinutes: { type: Number, default: 10, min: 1, max: 180 },

  // Phase 2 — the escalation chain itself, in order. "Notify Wife → no
  // response → Notify Son → no response → Notify Daughter → no response →
  // Notify Doctor."
  steps: [escalationStepSchema],

  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

applyCleanJSON(escalationPolicySchema);
escalationPolicySchema.statics.TARGET_TYPES = TARGET_TYPES;

module.exports = mongoose.model('EscalationPolicy', escalationPolicySchema);
