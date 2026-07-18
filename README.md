# Caretaker24 — monorepo

Frontend (React Native / Expo) and backend (Node.js / Express / MongoDB) live in one repo
and run together with a single command — but as of this update, they're **two fully
independent projects** side by side, not an npm workspace. That's a deliberate change, not
an oversight — see "Why not npm workspaces?" below.

```
caretaker24/
├── package.json      convenience scripts — `npm start` runs both at once
├── .github/workflows/ builds an Android APK on GitHub's free cloud runners — no EAS needed
├── mobile/            React Native app (Expo, SDK 54) — its OWN independent node_modules
└── server/            Node.js + Express + MongoDB API — its OWN independent node_modules
```

## Setup

```bash
npm run install:all                  # installs mobile/ and server/ independently, one command
npx expo install --fix --prefix mobile   # corrects expo-* package versions to exactly what SDK 54 expects
cp server/.env.example server/.env   # fill in MongoDB URI, JWT secrets, API keys — see server/README.md
```

## Why not npm workspaces?

An earlier version of this project used npm workspaces (`"workspaces": ["server", "mobile"]`)
specifically to make `npm install` from the root install everything in one pass. That's a
completely reasonable, standard pattern for most Node projects — but Expo/React Native's
tooling has real, hard assumptions about `node_modules` living directly inside the app's
own folder (its default entry point does a hardcoded relative import, and the native
Android/iOS build scripts `expo prebuild` generates assume the same thing). npm workspaces
are free to **hoist** shared dependencies up to the monorepo root as a space-saving
optimization — which silently breaks both of those assumptions, and did, repeatedly,
across a `None of these files exist: App(...)` Metro error and a `Cannot convert '' to
File` Gradle error that kept recurring in slightly different shapes no matter how it was
patched.

Removing workspaces removes the entire class of bug at the source: `mobile/` now behaves
exactly like a normal, standalone Expo project (because it is one), which is what Expo's
own tooling is actually built and tested against. `npm run install:all` still gives you
the "one command installs everything" convenience — it just runs two separate,
independent installs instead of relying on npm's hoisting mechanism to combine them.

## Run both at once

```bash
npm start
```

This starts the backend (`server`, port 4000) and the Expo dev server (`mobile`) together
in one terminal, colour-coded (`npm run dev` does the exact same thing, kept as an alias).
Or run them separately:

```bash
npm run dev:server     # just the API
npm run dev:mobile     # just Expo
```

Point the app at the backend in `mobile/src/config.js` — use your computer's LAN IP (not
`localhost`, which on a phone means the phone itself) so Expo Go/your dev-client build on
a physical device can reach it:

```js
export const API_BASE_URL = 'http://192.168.1.42:4000';
```

## Security architecture (why this is production-grade, not a demo)

**JWT access + refresh tokens, properly separated:**
- **Access tokens** are short-lived (15 min), stateless JWTs — cheap to verify on every
  request, no DB lookup needed, but that also means they *can't* be individually revoked
  before they expire. That's fine because 15 minutes is a small blast radius.
- **Refresh tokens** are long-lived (30 days) but are *opaque random strings*, not JWTs.
  The raw token goes to the client (stored in `expo-secure-store`, backed by iOS Keychain
  / Android Keystore); only its SHA-256 hash is stored in MongoDB. This means a refresh
  token can be individually revoked, listed as an active "session," and — critically —
  **rotated**.

**Refresh token rotation with theft detection:**
Every time a refresh token is used, it's immediately invalidated and a new one is issued
in its place, chained together in a "family." If someone ever presents an *already-used*
refresh token (because, say, it was stolen from device storage or intercepted and the
attacker is racing the real user), the entire family is revoked and every device tied to
it is forced to sign in again. This is the same pattern used by major identity providers
(Auth0, Okta) — see `server/src/services/tokenService.js` for the full implementation.

**On the mobile side**, `mobile/src/services/apiClient.js` wraps every authenticated
request: if a call comes back `401` because the access token expired, it transparently
refreshes and retries once — the user never sees a failure just because 15 minutes
passed. If the *refresh* token itself is invalid (expired, revoked, or reuse was
detected), the app forces a clean sign-out back to the login screen. Concurrent 401s are
coalesced into a single refresh call (single-flight) so multiple simultaneous requests
can't race each other into triggering false "reuse detected" lockouts.

**Other production hardening already in place:**
- `bcrypt` password hashing (cost factor 12)
- Account lockout after 5 failed login attempts (15-minute cooldown)
- Per-route rate limiting: strict on `/api/auth/*` (10/15min), stricter still on OTP send
  (3/10min, since SMS costs money and is an abuse vector), generous elsewhere
- `zod` schema validation on every auth input — malformed requests are rejected before
  touching the database, with clear field-level error messages
- `express-mongo-sanitize` strips NoSQL-injection operators (`$ne`, `$gt`, etc.) from
  request bodies/query/params
- `helmet` security headers, environment-driven CORS allowlist
- Google/Apple OAuth tokens are verified server-side against the providers' public keys —
  the app never self-asserts identity
- Server logs full error detail always; clients only ever see a generic message for
  unexpected 500s in production (no stack traces or library internals leak out)
- Session management: users can list every active "device" (`GET /api/auth/sessions`) and
  revoke one (`POST /api/auth/logout`) or all at once (`POST /api/auth/logout-all`)

## What's still needed before a real launch

This is genuinely production-grade *code*, but "production ready" also depends on
operational things no one can hand you in a chat:

- [ ] Deploy the backend somewhere with a public HTTPS URL (Render, Railway, Fly.io, a
      VPS) — tokens must never travel over plain HTTP
- [ ] MongoDB Atlas (or your own backup strategy if self-hosting) with automated backups
- [ ] Real API keys for Anthropic, Google OAuth, Apple Sign In, Twilio, Razorpay, Stripe
      (all currently placeholders in `.env.example`)
- [ ] Error tracking (Sentry or similar) wired into both the backend and the app
- [ ] This code has been syntax-checked (every backend file via `node --check`, every
      import/export cross-referenced programmatically) but **not run against a live
      MongoDB instance or a real device** in this environment — test the full signup →
      login → token-expiry → refresh flow yourself before shipping
- [ ] EAS Build account + Apple Developer account for the actual `.apk`/`.ipa` — see
      `mobile/README.md` for exact commands
