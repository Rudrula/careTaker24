const express = require('express');
const bcrypt = require('bcryptjs');
const { OAuth2Client } = require('google-auth-library');
const appleSignin = require('apple-signin-auth');
const User = require('../models/User');
const {
  issueTokenPair, rotateRefreshToken, revokeRefreshToken, revokeSessionFamily, revokeAllUserTokens, listActiveSessions,
} = require('../services/tokenService');
const { authenticate } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');
const { authLimiter, otpLimiter } = require('../middleware/rateLimiters');
const {
  registerSchema, loginSchema, refreshSchema, otpSendSchema, otpVerifySchema, googleAuthSchema, appleAuthSchema,
} = require('../validation/authSchemas');
const otpService = require('../services/otpService');

const router = express.Router();
const googleClient = new OAuth2Client();

const BCRYPT_ROUNDS = 12;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes

function deviceInfoFrom(req) {
  return (req.headers['user-agent'] || 'unknown device').slice(0, 200);
}

router.post('/register', authLimiter, validateBody(registerSchema), async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ error: 'An account with that email already exists.' });
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await User.create({ name, email, passwordHash });
    const tokens = await issueTokenPair(user, deviceInfoFrom(req));
    res.status(201).json({ ...tokens, user });
  } catch (err) { next(err); }
});

router.post('/login', authLimiter, validateBody(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    // Constant-shape response whether the user exists or not, to avoid
    // leaking which emails are registered via response timing/content.
    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    if (user.lockUntil && user.lockUntil > new Date()) {
      const minutesLeft = Math.ceil((user.lockUntil - Date.now()) / 60000);
      return res.status(423).json({ error: `Too many failed attempts. Try again in ${minutesLeft} minute(s).` });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      if (user.failedLoginAttempts >= MAX_LOGIN_ATTEMPTS) {
        user.lockUntil = new Date(Date.now() + LOCK_DURATION_MS);
        user.failedLoginAttempts = 0;
      }
      await user.save();
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    await user.save();

    const tokens = await issueTokenPair(user, deviceInfoFrom(req));
    res.json({ ...tokens, user });
  } catch (err) { next(err); }
});

router.post('/refresh', validateBody(refreshSchema), async (req, res, next) => {
  try {
    const tokens = await rotateRefreshToken(req.body.refreshToken, deviceInfoFrom(req));
    res.json({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
  } catch (err) { next(err); }
});

// Single-device sign out — revokes only the refresh token this device holds.
router.post('/logout', validateBody(refreshSchema), async (req, res, next) => {
  try {
    await revokeRefreshToken(req.body.refreshToken);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// Every device at once — the user must be currently authenticated with a
// still-valid access token to call this (can't be done with just a stolen
// refresh token, which is intentional).
router.post('/logout-all', authenticate, async (req, res, next) => {
  try {
    await revokeAllUserTokens(req.user._id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// Backs a "manage active sessions" screen — shows every device with a live
// refresh token so the user can spot and revoke ones they don't recognize.
router.get('/sessions', authenticate, async (req, res, next) => {
  try {
    res.json(await listActiveSessions(req.user._id));
  } catch (err) { next(err); }
});

// Revoke one specific session (e.g. "sign out that old phone I lost") —
// scoped to req.user._id so a user can only ever revoke their own sessions,
// never another account's.
router.delete('/sessions/:family', authenticate, async (req, res, next) => {
  try {
    await revokeSessionFamily(req.user._id, req.params.family);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.post('/otp/send', otpLimiter, validateBody(otpSendSchema), async (req, res, next) => {
  try {
    await otpService.sendOtp(req.body.phone);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.post('/otp/verify', authLimiter, validateBody(otpVerifySchema), async (req, res, next) => {
  try {
    const { phone, otp } = req.body;
    const approved = await otpService.checkOtp(phone, otp);
    if (!approved) return res.status(401).json({ error: 'Incorrect or expired OTP.' });
    let user = await User.findOne({ phone });
    if (!user) user = await User.create({ name: 'New user', phone });
    const tokens = await issueTokenPair(user, deviceInfoFrom(req));
    res.json({ ...tokens, user });
  } catch (err) { next(err); }
});

router.post('/google', authLimiter, validateBody(googleAuthSchema), async (req, res, next) => {
  try {
    const { idToken } = req.body;
    const ticket = await googleClient.verifyIdToken({ idToken, audience: process.env.GOOGLE_WEB_CLIENT_ID });
    const payload = ticket.getPayload();
    let user = await User.findOne({ $or: [{ googleId: payload.sub }, { email: payload.email }] });
    if (!user) user = await User.create({ name: payload.name, email: payload.email, googleId: payload.sub });
    else if (!user.googleId) { user.googleId = payload.sub; await user.save(); }
    const tokens = await issueTokenPair(user, deviceInfoFrom(req));
    res.json({ ...tokens, user });
  } catch (err) { next(err); }
});

router.post('/apple', authLimiter, validateBody(appleAuthSchema), async (req, res, next) => {
  try {
    const { identityToken, fullName, email } = req.body;
    const payload = await appleSignin.verifyIdToken(identityToken, { audience: process.env.APPLE_BUNDLE_ID });
    let user = await User.findOne({ $or: [{ appleId: payload.sub }, { email: email || payload.email }] });
    if (!user) {
      const name = fullName ? `${fullName.givenName || ''} ${fullName.familyName || ''}`.trim() : 'New user';
      user = await User.create({ name: name || 'New user', email: email || payload.email, appleId: payload.sub });
    } else if (!user.appleId) { user.appleId = payload.sub; await user.save(); }
    const tokens = await issueTokenPair(user, deviceInfoFrom(req));
    res.json({ ...tokens, user });
  } catch (err) { next(err); }
});

module.exports = router;
