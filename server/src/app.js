const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoSanitize = require('express-mongo-sanitize');
const { errorHandler } = require('./middleware/errorHandler');
const { apiLimiter } = require('./middleware/rateLimiters');
const { stripeWebhookHandler } = require('./routes/payments');

function buildApp() {
  const app = express();

  app.use(helmet());

  // CORS allowlist: set CORS_ORIGIN to a comma-separated list of exact
  // origins in production (e.g. "https://caretaker24.com"). The wildcard
  // fallback is fine for local development only — a mobile app doesn't send
  // an Origin header at all, so CORS mainly matters if you ever add a web
  // dashboard that calls this same API from a browser.
  const allowedOrigins = (process.env.CORS_ORIGIN || '*').split(',').map(s => s.trim());
  app.use(cors({
    origin: allowedOrigins.includes('*') ? '*' : allowedOrigins,
    credentials: true,
  }));

  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

  // Stripe webhook needs the raw body for signature verification — must be
  // registered before express.json().
  app.post('/api/payments/stripe/webhook', express.raw({ type: 'application/json' }), stripeWebhookHandler);

  app.use(express.json({ limit: '10mb' })); // generous limit for base64 prescription photos

  // Strips any key starting with "$" or containing "." from req.body/query/params
  // — without this, a crafted body like { "email": { "$ne": null } } could
  // bypass a naive findOne({ email }) lookup. Cheap insurance, zero downside.
  app.use(mongoSanitize());

  app.use('/api', apiLimiter); // auth routes layer stricter limiters on top of this — see routes/auth.js

  app.get('/health', (_req, res) => res.json({ ok: true }));

  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/families', require('./routes/families'));
  app.use('/api/care-circles', require('./routes/careCircles'));
  app.use('/api/invitations', require('./routes/invitations'));
  app.use('/api/medicines', require('./routes/medicines'));
  app.use('/api/care-events', require('./routes/careEvents'));
  app.use('/api/escalation-policy', require('./routes/escalationPolicy'));
  app.use('/api/escalation-events', require('./routes/escalationEvents'));
  app.use('/api/contacts', require('./routes/contacts'));
  app.use('/api/bills', require('./routes/bills'));
  app.use('/api/reports', require('./routes/reports'));
  app.use('/api/activity', require('./routes/activity'));
  app.use('/api/devices', require('./routes/devices'));
  app.use('/api/alerts', require('./routes/alerts'));
  app.use('/api/ai', require('./routes/ai'));
  app.use('/api/payments', require('./routes/payments'));

  app.use((req, res) => res.status(404).json({ error: 'Not found.' }));
  app.use(errorHandler);
  return app;
}

module.exports = { buildApp };
