const mongoose = require('mongoose');
const { applyCleanJSON } = require('./_helpers');

// One document per missed-dose escalation run. `currentPhase`/`currentStep`
// together act as a cursor into the policy that was active when this run
// started (the policy snapshot is copied in at creation time — see
// `policySnapshot` — so editing the policy later never rewrites history or
// disrupts a run already in progress).
const PHASES = ['reminders', 'escalating', 'resolved', 'exhausted'];

const escalationLogEntrySchema = new mongoose.Schema({
  at: { type: Date, default: Date.now },
  phase: { type: String, enum: PHASES, required: true },
  label: { type: String, required: true }, // "Reminder 2 of 3 sent to Asha", "Notified Wife", "Acknowledged by Son"
  notified: { type: Boolean, default: false }, // false for pure log entries like "started" / "resolved"
}, { _id: false });

const escalationEventSchema = new mongoose.Schema({
  familyId: { type: mongoose.Schema.Types.ObjectId, ref: 'CareCircle', required: true, index: true },
  medicineId: { type: mongoose.Schema.Types.ObjectId, ref: 'Medicine', required: true, index: true },
  medicineName: { type: String, required: true },
  scheduledDate: { type: String, required: true }, // "YYYY-MM-DD" — one active event per medicine per day, enforced below

  // A frozen copy of the policy at start time (see comment above).
  policySnapshot: { type: mongoose.Schema.Types.Mixed, required: true },

  phase: { type: String, enum: PHASES, default: 'reminders' },
  reminderCount: { type: Number, default: 0 }, // how many phase-1 reminders have fired so far
  stepIndex: { type: Number, default: -1 },    // -1 while still in phase 1; 0..N-1 once escalating through policySnapshot.steps

  nextActionAt: { type: Date, required: true, index: true }, // when the scheduler should next advance this event
  status: { type: String, enum: ['active', 'resolved', 'exhausted'], default: 'active', index: true },
  resolvedAt: { type: Date, default: null },
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  resolution: { type: String, enum: ['taken', 'skipped', 'acknowledged', null], default: null },

  log: [escalationLogEntrySchema],
}, { timestamps: true });

escalationEventSchema.index({ medicineId: 1, scheduledDate: 1 }, { unique: true });
escalationEventSchema.index({ status: 1, nextActionAt: 1 }); // what the scheduler polls on

applyCleanJSON(escalationEventSchema);
escalationEventSchema.statics.PHASES = PHASES;

module.exports = mongoose.model('EscalationEvent', escalationEventSchema);
