const rateLimit = require('express-rate-limit');

// General API traffic — generous, just stops runaway clients.
const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300 });

// Login/register — tighter, since this is what credential-stuffing bots hit.
// Keyed by IP + email so one person mistyping their password repeatedly
// doesn't get blocked by traffic from other users on the same IP (e.g.
// shared NAT / campus WiFi), while still stopping distributed attempts
// against a single account.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${req.ip}:${(req.body?.email || req.body?.phone || '').toLowerCase()}`,
  message: { error: 'Too many attempts. Please wait a few minutes and try again.' },
});

// OTP send — SMS costs money per send and is a common abuse vector
// (bombing a phone number with texts), so this is the strictest of all.
const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.body?.phone || req.ip,
  message: { error: 'Too many OTP requests for this number. Please wait 10 minutes.' },
});

// Invitation create/resend — SMS and WhatsApp deliveries cost money per
// send just like OTP, and an unbounded invite-resend loop is a real way to
// harass whoever's on the other end of the phone number/email. Keyed by
// the sender (not the target), since a legitimate user inviting five
// different family members in a row shouldn't be blocked by a single
// target's send count.
const inviteLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.user?._id ? String(req.user._id) : req.ip),
  message: { error: 'Too many invitations sent. Please wait a few minutes and try again.' },
});

module.exports = { apiLimiter, authLimiter, otpLimiter, inviteLimiter };
