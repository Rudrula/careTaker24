const mongoose = require('mongoose');
const { applyCleanJSON } = require('./_helpers');

const deviceSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  familyId: { type: mongoose.Schema.Types.ObjectId, ref: 'CareCircle', required: true, index: true },
  expoPushToken: { type: String, required: true, unique: true },
  role: { type: String, enum: ['senior', 'family', 'caregiver', 'viewer'], required: true },
  platform: { type: String, default: '' },
}, { timestamps: true });

applyCleanJSON(deviceSchema);
module.exports = mongoose.model('Device', deviceSchema);
