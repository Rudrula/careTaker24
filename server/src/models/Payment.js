const mongoose = require('mongoose');
const { applyCleanJSON } = require('./_helpers');

const paymentSchema = new mongoose.Schema({
  familyId: { type: mongoose.Schema.Types.ObjectId, ref: 'CareCircle', required: true, index: true },
  purpose: { type: String, default: 'subscription' },
  provider: { type: String, enum: ['razorpay', 'stripe'], required: true },
  amount: { type: Number, required: true }, // smallest currency unit
  currency: { type: String, default: 'INR' },
  providerOrderId: { type: String, default: null },
  providerSessionUrl: { type: String, default: null },
  status: { type: String, enum: ['created', 'paid', 'failed'], default: 'created' },
}, { timestamps: true });

applyCleanJSON(paymentSchema);
module.exports = mongoose.model('Payment', paymentSchema);
