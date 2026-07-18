const mongoose = require('mongoose');
const { applyCleanJSON } = require('./_helpers');

const contactSchema = new mongoose.Schema({
  familyId: { type: mongoose.Schema.Types.ObjectId, ref: 'CareCircle', required: true, index: true },
  name: { type: String, required: true },
  phone: { type: String, required: true },
  relation: { type: String, default: 'Contact' },
}, { timestamps: true });

applyCleanJSON(contactSchema);
module.exports = mongoose.model('Contact', contactSchema);
