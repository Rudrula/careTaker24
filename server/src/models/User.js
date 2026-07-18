const mongoose = require('mongoose');
const { applyCleanJSON } = require('./_helpers');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
  phone: { type: String, unique: true, sparse: true },
  passwordHash: { type: String },
  googleId: { type: String, unique: true, sparse: true },
  appleId: { type: String, unique: true, sparse: true },
  country: { type: String, default: '' },
  bloodType: { type: String, default: '' },
  allergies: { type: String, default: '' },
  conditions: { type: String, default: '' },
  // Brute-force protection: increments on each failed login, resets on
  // success. After MAX_LOGIN_ATTEMPTS (see auth.js), the account is locked
  // until lockUntil passes — this stops password-guessing scripts without
  // permanently locking a real user out.
  failedLoginAttempts: { type: Number, default: 0 },
  lockUntil: { type: Date, default: null },
  // Which CareCircle's data (medicines, bills, contacts, reports...) shows
  // when the app opens. Every existing route that used to look up "the"
  // Family now resolves this instead — see middleware/auth.js — so
  // switching circles in the UI just updates this one field.
  activeCareCircleId: { type: mongoose.Schema.Types.ObjectId, ref: 'CareCircle', default: null },
}, { timestamps: true });

applyCleanJSON(userSchema);
module.exports = mongoose.model('User', userSchema);
