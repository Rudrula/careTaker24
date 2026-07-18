# Caretaker24 backend — Node.js + Express + MongoDB

This is the real backend for the React Native app in `../mobile`. Every route
path matches exactly what the app already calls — no changes needed on the app side beyond
setting `API_BASE_URL`.

## Quick start

From the monorepo root:
```bash
npm run install:all                  # installs mobile and server independently, one command
cp server/.env.example server/.env   # fill in every value — see comments in the file
npm run dev:server                    # nodemon, restarts on file change
```
Or from this folder directly:
```bash
cd server && npm install && cp .env.example .env && npm run dev
```

Health check once running: `GET http://localhost:4000/health` → `{"ok":true}`

## MongoDB — two ways to get one running

**Option A — local MongoDB (fastest for development):**
```bash
# macOS:
brew tap mongodb/brew && brew install mongodb-community && brew services start mongodb-community
# Ubuntu/Debian:
sudo apt install mongodb
# Then in .env:
MONGODB_URI=mongodb://localhost:27017/caretaker24
```

**Option B — MongoDB Atlas (free tier, no local install, works from anywhere):**
1. [mongodb.com/cloud/atlas](https://mongodb.com/cloud/atlas) → create a free M0 cluster
2. Database Access → add a user with a password
3. Network Access → allow your current IP (or `0.0.0.0/0` for development only)
4. Connect → "Drivers" → copy the connection string into `.env`:
   ```
   MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/caretaker24
   ```

## What else you need before every feature works

| Feature | Requires |
|---|---|
| Everything except AI/payments/OTP/OAuth | Just MongoDB — works immediately |
| AI chat, digest, prescription scan, voice intent | `ANTHROPIC_API_KEY` from console.anthropic.com |
| Google Sign-In | `GOOGLE_WEB_CLIENT_ID` from Google Cloud Console |
| Apple Sign In | `APPLE_BUNDLE_ID` (must match the app's iOS bundle ID) |
| Mobile OTP | Twilio account + a Verify Service SID |
| Razorpay payments | `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` (test mode keys work for dev) |
| Stripe payments | `STRIPE_SECRET_KEY` + webhook secret (use `stripe listen` CLI for local testing) |
| SOS push notifications | Nothing extra — `expo-server-sdk` needs no API key, just registered device tokens |

Every route degrades gracefully if its specific env var is missing — you'll get a clear
500 error naming the missing config, not a silent failure, so you can build incrementally
(e.g. get medicines/contacts/bills working first, add AI and payments later).

## API surface

```
POST   /api/auth/register            email + password signup
POST   /api/auth/login               email + password login
POST   /api/auth/refresh             exchange refresh token for a new access token
POST   /api/auth/logout-all          invalidate every refresh token (logout all devices)
POST   /api/auth/otp/send            send SMS OTP (Twilio Verify)
POST   /api/auth/otp/verify          verify OTP, returns JWT pair
POST   /api/auth/google              verify Google id_token, returns JWT pair
POST   /api/auth/apple               verify Apple identityToken, returns JWT pair

POST   /api/families                 create a household (legacy — prefer /api/care-circles for new circles)
POST   /api/families/join            join via invite code
GET    /api/families/me              current active Care Circle + role
PATCH  /api/families/me              update seniorName/tier/timezone

GET    /api/care-circles/templates       the 7 built-in templates (MyCare, Parents Care, Pregnancy Care, Child Care, My Family, Grandparents Care, Pet Care)
GET    /api/care-circles                 list every circle you belong to (?status=active|archived)
POST   /api/care-circles                 create — from a templateId or fully custom
GET    /api/care-circles/:id             get one (includes isOwner/myRole/isActive for the caller)
PATCH  /api/care-circles/:id             rename / change icon / seniorName / timezone / tier
DELETE /api/care-circles/:id             soft delete (owner only) — recoverable via /restore
POST   /api/care-circles/:id/archive     archive (any manager)
POST   /api/care-circles/:id/restore     un-archive, or un-delete (owner only for the latter)
POST   /api/care-circles/:id/duplicate   copy the circle's structure — NOT medicines/bills/history
POST   /api/care-circles/:id/transfer-ownership   { newOwnerUserId } — owner only
POST   /api/care-circles/:id/leave       owner must transfer ownership first
POST   /api/care-circles/:id/set-active  switch which circle req.family resolves to everywhere else
GET    /api/care-circles/:id/members             list members with role/permissions/isPrimaryContact
PATCH  /api/care-circles/:id/members/:userId     update a member's role / permissions / isPrimaryContact
DELETE /api/care-circles/:id/members/:userId     remove a member (use /leave to remove yourself)
GET    /api/care-circles/:id/blocked-users       list blocked users for this circle
POST   /api/care-circles/:id/block-user          block by userId, email, or phone
DELETE /api/care-circles/:id/block-user/:blockId unblock

POST   /api/invitations                    create — { careCircleId, method: qr|email|phone|whatsapp|sms|link, targetEmail?, targetPhone?, proposedRole }
GET    /api/invitations?careCircleId=&status=   list invitations for a circle (manager view)
GET    /api/invitations/mine               invitations addressed to you, by your own email/phone
GET    /api/invitations/token/:token       resolve an invite (QR/link/email/SMS all land here)
POST   /api/invitations/token/:token/accept
POST   /api/invitations/token/:token/reject
POST   /api/invitations/:id/resend         resets expiry, re-delivers
POST   /api/invitations/:id/cancel

GET    /api/medicines                list
POST   /api/medicines                add
PATCH  /api/medicines/:id/take       mark taken (today)
PATCH  /api/medicines/:id/skip       mark deliberately skipped (today) — distinct from "missed"
POST   /api/medicines/:id/missed-alert   notify this circle's primary-contact member(s) that a dose was missed — idempotent per day
DELETE /api/medicines/:id            remove

GET    /api/care-circles/timeline    Care Timeline — "Today's Family Summary" aggregated across every active circle you belong to (missed doses, low stock, upcoming events, full-adherence confirmations, severity-sorted)
GET    /api/care-events              upcoming appointments/vaccinations/check-ups for the active circle (?includeCompleted=true)
POST   /api/care-events              add — { title, type: appointment|checkup|vaccination|custom, dueDate, notes? }
PATCH  /api/care-events/:id          update (including marking completed)
DELETE /api/care-events/:id          remove

GET    /api/escalation-policy        get the active circle's Smart Escalation config (disabled-default shape if never configured)
PUT    /api/escalation-policy        full replace — { enabled, reminderRepeatCount, reminderIntervalMinutes, steps: [{ targetType, targetId, label, waitMinutes }] }
GET    /api/escalation-events        active/resolved/exhausted runs for the active circle (?status=active|resolved|exhausted|all)
POST   /api/escalation-events/:id/acknowledge   stop an in-progress escalation without necessarily marking the medicine taken

GET    /api/contacts / POST / PATCH /:id / DELETE /:id     emergency contacts CRUD
GET    /api/bills / POST / PATCH /:id/pay / DELETE /:id     bills CRUD

GET    /api/reports?limit=7          adherence/water/steps history
POST   /api/reports/steps            log steps { amount }
POST   /api/reports/water            log a glass of water
POST   /api/reports/checkin          log a check-in
POST   /api/reports/sync-adherence   recompute today's adherence % from medicines

GET    /api/activity?limit=30        activity feed

POST   /api/devices                  register an Expo push token
POST   /api/alerts                   trigger SOS — { lat?, lng? } — pushes to every family-role device, includes a Google Maps link if location was provided

POST   /api/ai/chat                  { messages } → { reply }
POST   /api/ai/digest                snapshot → { summary }
POST   /api/ai/scan-prescription     { image, mimeType } → { medicines }
POST   /api/ai/voice-intent          { text, medicines } → { action, medicineName, reply }

POST   /api/payments/razorpay/order    → { orderId, keyId, ... } for native Razorpay Checkout
POST   /api/payments/razorpay/verify   verify signature after payment
POST   /api/payments/stripe/checkout   → { checkoutUrl } to open in-app browser
POST   /api/payments/stripe/webhook    Stripe calls this directly (raw body, not JSON)
```

All routes except `/health` and `/api/auth/*` require `Authorization: Bearer <accessToken>`.

## Care Circles — multi-tenant architecture

A user can belong to many Care Circles at once (e.g. "Parents Care," "Pet Care," "My
Family") instead of the original single-household model. The key design decision: **every
pre-existing route (medicines, bills, contacts, reports, activity, devices, alerts, ai,
payments) needed zero changes.** `middleware/auth.js` resolves `req.family` to whichever
CareCircle the caller's `User.activeCareCircleId` currently points at, falling back to
their oldest active membership if unset — so `req.family._id` means exactly what it always
did, just scoped per-circle now instead of globally.

**Ownership vs. role vs. permissions — three separate axes on purpose:**
- `CareCircle.ownerId` — exactly one owner, transferable, always has full rights regardless
  of their stored permissions object (source of truth, not just a convenience flag)
- `member.role` — a relationship *persona* (`senior`/`family`/`caregiver`/`viewer`), already
  load-bearing elsewhere (SOS pushes target every `family`-role member)
- `member.permissions` — fine-grained capability flags (`canEditMedicines`,
  `canManageBilling`, `canInviteMembers`, `canManageMembers`, `canDeleteCircle`,
  `canViewReports`), independently editable per member

**Missed-dose → primary contact:** any member can be flagged `isPrimaryContact` (multiple
allowed — e.g. two children who both want alerts). For circles that haven't turned on the
Smart Escalation Engine (see below), the mobile app — which already computes each
medicine's "missed" status locally to render the status pill — calls
`POST /api/medicines/:id/missed-alert` the moment it detects a *new* miss. The route is
idempotent per day via `Medicine.lastMissedAlertDate`, so calling it repeatedly (app
restarts, multiple family members' phones open) never sends duplicate pushes. Falls back
to the owner if no primary contact is set, so an alert is never silently dropped.

## Smart Escalation Engine

The one piece of this backend that genuinely needs to act on its own over time, whether or
not anyone has the app open: "Dad missed his medicine → remind him 3 times, 10 minutes
apart → still nothing → notify Wife → no response in 15 min → notify Son → no response →
notify Daughter → no response → notify the family Doctor." Every number and every person
in that chain is configurable per Care Circle via `PUT /api/escalation-policy`.

**Why this needed real infrastructure, unlike everything else in this backend.** The
pattern used everywhere else (invitation expiry, missed-dose alerts) is "resolve lazily
when a client happens to ask." That's fine for a status the UI computes on render, but an
escalation step *has* to fire on its own after N minutes pass — it can't wait for someone
to open the app, or the entire safety-net feature is pointless. `services/escalationScheduler.js`
runs a `setInterval` poll (default every 60s, `ESCALATION_POLL_INTERVAL_MS`) inside the
same Node process as the API server — no Redis, no separate worker, no new external
dependency. It does two things every tick: (1) scans every circle with escalation enabled
for medicines that just crossed the missed threshold and starts a new run, and (2) advances
every currently-active run whose wait period has elapsed.

**Two collections model the feature:**
- `EscalationPolicy` — one per circle, the *configuration*: reminder repeat count/interval,
  then an ordered `steps` array (each step: notify a circle member or a plain Contact like
  the family doctor, then wait N minutes for a response).
- `EscalationEvent` — one per missed dose per day, the *live run*. It snapshots the policy
  at start time (`policySnapshot`) so editing the policy later never rewrites a chain
  already in progress, tracks which phase/step it's currently on, and keeps a full
  human-readable log ("Reminder 2 of 3 sent," "Notified Wife," "Resolved (taken)").

**Resolution** happens automatically — `PATCH /api/medicines/:id/take` and `/skip` both
call `resolveEscalationForMedicine()`, so the moment the dose is actually marked taken or
skipped, the chain stops advancing regardless of which phase it's in. Anyone who receives
an escalation push can also stop it directly via the notification's "I've got this ✓"
button (`POST /api/escalation-events/:id/acknowledge`) without needing to mark the
medicine themselves — e.g. the wife calls her husband directly and confirms he's fine.

**One real limitation worth knowing if you ever scale horizontally:** running this on
multiple server instances behind a load balancer would mean every instance polls
independently, and the same step could fire more than once. Fine for a single-instance
deployment; if you do scale out, either pin the scheduler to one designated instance or
move it to a real job queue (Bull/Agenda + Redis).

**Invitations** support all 6 methods (QR, email, phone, WhatsApp, SMS, link) through one
`Invitation` model with a `method` field — QR/link don't need server-side delivery (the
app renders/shares the token-based URL itself), email/SMS/WhatsApp go through
`services/invitationDelivery.js` (nodemailer / Twilio), degrading gracefully to
"here's the link, share it yourself" if those aren't configured. Every create checks, in
order: blocked-user list → already-a-member → duplicate-pending-invite, before creating a
new one. Expiry is resolved lazily (checked on every read/write against `expiresAt`)
rather than needing a background job.

## Connecting the mobile app to this backend

Edit `mobile/src/config.js`:

```js
export const API_BASE_URL = 'http://192.168.1.42:4000'; // your computer's LAN IP, port 4000
```

Find your LAN IP: `ipconfig` (Windows, look for IPv4) or `ifconfig | grep inet` (Mac/Linux).
Your phone and computer must be on the same WiFi network for this to work with Expo Go /
a dev-client build during development. For a production build, deploy this backend
somewhere with a public HTTPS URL (Render, Railway, Fly.io, a VPS, etc.) and use that URL
instead — phones on cellular data need a real public address, not your LAN IP.

## Production checklist

- [ ] Move all secrets out of `.env` into a real secrets manager before deploying
- [ ] Tighten the CORS origin (currently `*`) to your actual app's origin
- [ ] Add request validation (e.g. `zod` or `joi`) on every route — currently only
      presence checks, not type/format validation
- [ ] Set up MongoDB Atlas backups (or your own backup cron if self-hosting)
- [ ] Add structured logging + error tracking (e.g. Sentry) for production debugging
- [ ] Rate-limit `/api/ai/*` more tightly than the global limit — these calls cost money
- [ ] This code has been syntax-checked (`node --check` on all 33 files) but not run
      against a live MongoDB instance in this environment — test every route yourself
      with something like Postman/Insomnia before wiring the mobile app to it
