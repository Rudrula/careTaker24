const { runEscalationTick } = require('./escalationService');

// This backend has no external job queue (no Bull/Agenda/cron service) —
// the pattern used everywhere else here (invitation expiry, etc.) is
// "resolve lazily on read." That doesn't work for escalation: a step has
// to fire on its own after N minutes whether or not anyone ever opens the
// app again, or the entire feature is pointless. A simple in-process
// interval is the right amount of infrastructure for that requirement
// without introducing a new external dependency (Redis, a separate worker
// process, etc.) — it runs inside the same Node process as the API server.
//
// Caveat worth knowing: if you deploy multiple instances of this server
// behind a load balancer, EVERY instance will run this poller, so the
// same escalation step could fire more than once. For a single-instance
// deployment (which is plenty for this app's scale) this is a non-issue.
// If you do scale horizontally later, either run this poller in exactly
// one designated instance, or move it to a real job queue.
const POLL_INTERVAL_MS = Number(process.env.ESCALATION_POLL_INTERVAL_MS) || 60 * 1000;

let intervalHandle = null;

function startEscalationScheduler() {
  if (intervalHandle) return; // already running — avoid double-starting on hot reload
  intervalHandle = setInterval(() => {
    runEscalationTick().catch(err => console.error('Escalation tick failed:', err.message));
  }, POLL_INTERVAL_MS);
  console.log(`Escalation scheduler started — polling every ${POLL_INTERVAL_MS / 1000}s`);
}

function stopEscalationScheduler() {
  if (intervalHandle) { clearInterval(intervalHandle); intervalHandle = null; }
}

module.exports = { startEscalationScheduler, stopEscalationScheduler };
