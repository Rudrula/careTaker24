const mongoose = require('mongoose');
const { applyCleanJSON } = require('./_helpers');

const activityLogSchema = new mongoose.Schema({
  familyId: { type: mongoose.Schema.Types.ObjectId, ref: 'CareCircle', required: true, index: true },
  type: { type: String, required: true }, // medicine | bill | checkin | emergency | water | steps | contact
  message: { type: String, required: true },
  ts: { type: Date, default: Date.now },
});

applyCleanJSON(activityLogSchema);
module.exports = mongoose.model('ActivityLog', activityLogSchema);
