const mongoose = require('mongoose');
const { applyCleanJSON } = require('./_helpers');

const dailyReportSchema = new mongoose.Schema({
  familyId: { type: mongoose.Schema.Types.ObjectId, ref: 'CareCircle', required: true, index: true },
  date: { type: String, required: true }, // "YYYY-MM-DD"
  adherence: { type: Number, default: 0 },
  taken: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  waterGlasses: { type: Number, default: 0 },
  checkIns: { type: Number, default: 0 },
  steps: { type: Number, default: 0 },
  summary: { type: String, default: null },
}, { timestamps: true });

dailyReportSchema.index({ familyId: 1, date: 1 }, { unique: true });
applyCleanJSON(dailyReportSchema);
module.exports = mongoose.model('DailyReport', dailyReportSchema);
