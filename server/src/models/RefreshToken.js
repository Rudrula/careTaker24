const mongoose = require('mongoose');

// SECURITY DESIGN NOTE (why this exists instead of a simple JWT refresh token):
//
// A refresh token that's just a signed JWT can't be individually revoked
// before it expires — you can only invalidate ALL of a user's refresh
// tokens at once (e.g. by bumping a version number), which is too blunt for
// "sign out this one device" and can't detect theft.
//
// Instead: refresh tokens here are random opaque strings. The RAW token is
// sent to the client and stored in SecureStore; only its SHA-256 HASH is
// stored in MongoDB. Each successful refresh issues a brand-new token and
// immediately revokes the old one (rotation) — if a revoked/old token is
// ever presented again, it means it was stolen and reused, so we revoke the
// entire rotation chain ("family") as a precaution and force re-login.
const refreshTokenSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  tokenHash: { type: String, required: true, unique: true },
  family: { type: String, required: true, index: true }, // groups a chain of rotated tokens from one login
  deviceInfo: { type: String, default: '' },
  revoked: { type: Boolean, default: false },
  replacedByHash: { type: String, default: null },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });

// Auto-delete expired tokens — keeps the collection from growing forever.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('RefreshToken', refreshTokenSchema);
