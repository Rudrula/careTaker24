const mongoose = require('mongoose');
const { applyCleanJSON } = require('./_helpers');

const billSchema = new mongoose.Schema({
  familyId: { type: mongoose.Schema.Types.ObjectId, ref: 'CareCircle', required: true, index: true },
  name: { type: String, required: true },
  amount: { type: String, default: '' },
  dueDate: { type: String, required: true }, // "YYYY-MM-DD"
  recurring: { type: String, enum: ['monthly', 'yearly', 'once'], default: 'monthly' },
  paidThisCycle: { type: Boolean, default: false },
}, { timestamps: true });

applyCleanJSON(billSchema);
module.exports = mongoose.model('Bill', billSchema);
