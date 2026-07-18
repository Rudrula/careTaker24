const mongoose = require('mongoose');
const { applyCleanJSON } = require('./_helpers');

// Drives which emoji shows in reminder notifications and on the medicine
// card — a generic 💊 for everything looked identical whether it was an
// injection, eye drops, or a capsule, which matters for an elderly user
// scanning several reminders at a glance.
const MEDICINE_FORMS = ['tablet', 'capsule', 'liquid', 'injection', 'drops', 'inhaler', 'other'];

const medicineSchema = new mongoose.Schema({
  familyId: { type: mongoose.Schema.Types.ObjectId, ref: 'CareCircle', required: true, index: true },
  name: { type: String, required: true },
  dosage: { type: String, default: '' },
  form: { type: String, enum: MEDICINE_FORMS, default: 'tablet' },
  time: { type: String, required: true }, // "HH:MM" 24h
  instructions: { type: String, default: '' },
  purpose: { type: String, default: '' },
  stock: { type: Number, default: 30 },
  lastTakenDate: { type: String, default: null }, // "YYYY-MM-DD"
  lastTakenAt: { type: Date, default: null },
  lastSkippedDate: { type: String, default: null }, // "YYYY-MM-DD" — set by the Skip action
  lastMissedAlertDate: { type: String, default: null }, // "YYYY-MM-DD" — dedupe guard, see routes/medicines.js POST /:id/missed-alert
}, { timestamps: true });

applyCleanJSON(medicineSchema);
medicineSchema.statics.MEDICINE_FORMS = MEDICINE_FORMS;
module.exports = mongoose.model('Medicine', medicineSchema);
