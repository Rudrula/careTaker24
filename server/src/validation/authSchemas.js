const { z } = require('zod');

// Password policy: minimum 8 characters, at least one letter and one
// number. Not maximally strict (no special-char requirement) because this
// app's users skew elderly — overly complex rules just push people toward
// writing passwords on paper. Length + a number is a reasonable floor;
// pair it with account lockout (see auth.js) rather than pure complexity.
const password = z.string().min(8, 'Password must be at least 8 characters.')
  .regex(/[A-Za-z]/, 'Password must contain at least one letter.')
  .regex(/[0-9]/, 'Password must contain at least one number.');

const registerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.').max(100),
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  password,
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  password: z.string().min(1, 'Password is required.'),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'refreshToken is required.'),
});

const otpSendSchema = z.object({
  phone: z.string().regex(/^\+[1-9]\d{6,14}$/, 'Enter phone number in E.164 format, e.g. +14155551234.'),
});

const otpVerifySchema = z.object({
  phone: z.string().regex(/^\+[1-9]\d{6,14}$/),
  otp: z.string().regex(/^\d{4,8}$/, 'Enter the numeric code you received.'),
});

const googleAuthSchema = z.object({ idToken: z.string().min(10) });
const appleAuthSchema = z.object({
  identityToken: z.string().min(10),
  fullName: z.object({ givenName: z.string().optional(), familyName: z.string().optional() }).optional(),
  email: z.string().email().optional(),
});

module.exports = { registerSchema, loginSchema, refreshSchema, otpSendSchema, otpVerifySchema, googleAuthSchema, appleAuthSchema };
