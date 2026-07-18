const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const RefreshToken = require('../models/RefreshToken');

const REFRESH_TOKEN_BYTES = 48;
const REFRESH_TOKEN_TTL_MS = parseDuration(process.env.JWT_REFRESH_EXPIRES || '30d');

function parseDuration(s) {
  const m = /^(\d+)([smhd])$/.exec(s);
  if (!m) return 30 * 24 * 60 * 60 * 1000;
  const n = parseInt(m[1], 10);
  const mult = { s: 1000, m: 60000, h: 3600000, d: 86400000 }[m[2]];
  return n * mult;
}

function hashToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function signAccessToken(user) {
  return jwt.sign({ sub: user._id.toString() }, process.env.JWT_ACCESS_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m',
  });
}

// Issues a fresh access token + a brand-new refresh token, starting a new
// rotation "family". Call this on login/register/OAuth — NOT on refresh
// (use rotateRefreshToken for that, which continues the existing family).
async function issueTokenPair(user, deviceInfo = '') {
  const accessToken = signAccessToken(user);
  const rawRefresh = crypto.randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
  const family = crypto.randomUUID();
  await RefreshToken.create({
    userId: user._id,
    tokenHash: hashToken(rawRefresh),
    family,
    deviceInfo,
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
  });
  return { accessToken, refreshToken: rawRefresh };
}

// Validates a presented refresh token, rotates it (issues a new one, marks
// the old one used), and returns a fresh pair. Throws on any problem —
// including the critical "reuse detected" case, where the ENTIRE family is
// revoked so a stolen-then-reused token can't keep working indefinitely.
async function rotateRefreshToken(rawToken, deviceInfo = '') {
  const tokenHash = hashToken(rawToken);
  const record = await RefreshToken.findOne({ tokenHash });

  if (!record) {
    const err = new Error('Refresh token not recognized.');
    err.status = 401;
    throw err;
  }

  if (record.revoked) {
    // This exact token was already used once before (or explicitly revoked
    // by a logout). Presenting it again strongly suggests token theft —
    // kill every token in this rotation chain, forcing re-login everywhere.
    await RefreshToken.updateMany({ family: record.family }, { revoked: true });
    const err = new Error('Refresh token reuse detected — all sessions in this chain have been revoked. Please sign in again.');
    err.status = 401;
    throw err;
  }

  if (record.expiresAt < new Date()) {
    const err = new Error('Refresh token has expired. Please sign in again.');
    err.status = 401;
    throw err;
  }

  const User = require('../models/User');
  const user = await User.findById(record.userId);
  if (!user) {
    const err = new Error('User no longer exists.');
    err.status = 401;
    throw err;
  }

  const accessToken = signAccessToken(user);
  const rawNewRefresh = crypto.randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
  const newRecord = await RefreshToken.create({
    userId: user._id,
    tokenHash: hashToken(rawNewRefresh),
    family: record.family, // same chain — this is what makes reuse detection possible
    deviceInfo,
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
  });

  record.revoked = true;
  record.replacedByHash = newRecord.tokenHash;
  await record.save();

  return { accessToken, refreshToken: rawNewRefresh, userId: user._id };
}

// Revokes one specific device's refresh token (normal single-device sign out).
async function revokeRefreshToken(rawToken) {
  await RefreshToken.updateOne({ tokenHash: hashToken(rawToken) }, { revoked: true });
}

// Revokes a specific session by its rotation-chain id, scoped to a given
// user — this is how "sign out THAT device" works from a session list,
// since the server never re-exposes a raw refresh token to revoke by value
// (only its hash is ever stored).
async function revokeSessionFamily(userId, family) {
  await RefreshToken.updateMany({ userId, family }, { revoked: true });
}

// Revokes every refresh token for a user across every device/family chain —
// this is the real "log out from all devices."
async function revokeAllUserTokens(userId) {
  await RefreshToken.updateMany({ userId, revoked: false }, { revoked: true });
}

// Lets a user see (and selectively revoke) their own active sessions —
// backs the Profile screen's "Active sessions" list.
async function listActiveSessions(userId) {
  return RefreshToken.find({ userId, revoked: false, expiresAt: { $gt: new Date() } })
    .sort({ createdAt: -1 })
    .select('deviceInfo createdAt expiresAt family');
}

module.exports = {
  signAccessToken, issueTokenPair, rotateRefreshToken,
  revokeRefreshToken, revokeSessionFamily, revokeAllUserTokens, listActiveSessions,
};
