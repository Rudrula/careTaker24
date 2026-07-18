const mongoose = require('mongoose');
const crypto = require('crypto');
const { applyCleanJSON } = require('./_helpers');

const INVITE_METHODS = ['qr', 'email', 'phone', 'whatsapp', 'sms', 'link'];
const INVITE_STATUSES = ['pending', 'accepted', 'rejected', 'expired', 'cancelled'];
const INVITE_TTL_DAYS = 7;

function generateToken() {
  return crypto.randomBytes(24).toString('base64url'); // URL-safe — goes directly into the invite link / QR payload
}

const invitationSchema = new mongoose.Schema({
  careCircleId: { type: mongoose.Schema.Types.ObjectId, ref: 'CareCircle', required: true, index: true },
  invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  method: { type: String, enum: INVITE_METHODS, required: true },
  // Exactly one of these is set, matching `method` — kept as separate
  // fields (rather than one generic "target") so duplicate-detection
  // queries can index and match precisely regardless of method.
  targetEmail: { type: String, default: null, lowercase: true, trim: true },
  targetPhone: { type: String, default: null, trim: true },

  proposedRole: { type: String, enum: ['senior', 'family', 'caregiver', 'viewer'], default: 'family' },
  token: { type: String, required: true, unique: true, default: generateToken, index: true },

  status: { type: String, enum: INVITE_STATUSES, default: 'pending', index: true },
  resendCount: { type: Number, default: 0 },
  lastSentAt: { type: Date, default: Date.now },

  respondedAt: { type: Date, default: null },
  respondedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // set once the invited person has an account and accepts/rejects
  cancelledAt: { type: Date, default: null },
  cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

  expiresAt: { type: Date, required: true, default: () => new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000) },
}, { timestamps: true });

invitationSchema.index({ careCircleId: 1, targetEmail: 1, status: 1 });
invitationSchema.index({ careCircleId: 1, targetPhone: 1, status: 1 });

applyCleanJSON(invitationSchema);

invitationSchema.statics.INVITE_METHODS = INVITE_METHODS;
invitationSchema.statics.INVITE_TTL_DAYS = INVITE_TTL_DAYS;
invitationSchema.statics.generateToken = generateToken;

module.exports = mongoose.model('Invitation', invitationSchema);
