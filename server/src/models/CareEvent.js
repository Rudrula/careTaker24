const mongoose = require('mongoose');
const { applyCleanJSON } = require('./_helpers');

// Deliberately generic ("appointment" covers doctor visits, prenatal
// check-ups, dentist, etc.) rather than a rigid medical-event taxonomy —
// the Care Timeline just needs enough structure to say "what, for whom,
// when," not a full EHR.
const EVENT_TYPES = ['appointment', 'vaccination', 'checkup', 'custom'];

const careEventSchema = new mongoose.Schema({
  familyId: { type: mongoose.Schema.Types.ObjectId, ref: 'CareCircle', required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  type: { type: String, enum: EVENT_TYPES, default: 'appointment' },
  dueDate: { type: Date, required: true, index: true },
  notes: { type: String, default: '' },
  completed: { type: Boolean, default: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

careEventSchema.index({ familyId: 1, dueDate: 1 });

applyCleanJSON(careEventSchema);
careEventSchema.statics.EVENT_TYPES = EVENT_TYPES;

module.exports = mongoose.model('CareEvent', careEventSchema);
