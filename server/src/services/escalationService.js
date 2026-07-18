const EscalationPolicy = require('../models/EscalationPolicy');
const EscalationEvent = require('../models/EscalationEvent');
const Medicine = require('../models/Medicine');
const CareCircle = require('../models/CareCircle');
const Contact = require('../models/Contact');
const { pushToUserIds } = require('./pushService');
const { addActivity } = require('./activityLogger');

function todayStr() { return new Date().toISOString().slice(0, 10); }
function minutesFromNow(n) { return new Date(Date.now() + n * 60 * 1000); }

// A medicine counts as "missed" using the same 30-minute grace period the
// rest of the app already uses for the Missed status pill — kept as one
// constant here so the escalation engine and the UI's own missed-detection
// never drift out of sync with each other.
const MISSED_GRACE_MINUTES = 30;

function isMissed(medicine) {
  const today = todayStr();
  if (medicine.lastTakenDate === today || medicine.lastSkippedDate === today) return false;
  const [h, m] = (medicine.time || '').split(':').map(Number);
  if (!Number.isFinite(h)) return false;
  const scheduledMinutes = h * 60 + m;
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  return nowMinutes > scheduledMinutes + MISSED_GRACE_MINUTES;
}

// Resolves a step's target into { userIds, label, deliverable } — a
// Contact (e.g. the family doctor) has no app account, so it can't receive
// a push; it's tracked in the log either way, but `deliverable` tells the
// caller whether a push actually went out.
async function resolveStepTarget(step) {
  if (step.targetType === 'member') {
    return { userIds: [step.targetId], label: step.label, deliverable: true };
  }
  const contact = await Contact.findById(step.targetId).catch(() => null);
  return { userIds: [], label: step.label || contact?.name || 'contact', deliverable: false };
}

// ---- starting a new run --------------------------------------------------

// Scans every circle with escalation ENABLED for medicines that just
// crossed the missed threshold and don't already have a run today, and
// kicks one off. Called by the scheduler on every tick — this is what
// makes the whole engine autonomous rather than depending on the app being
// open on anyone's phone.
async function scanAndStartNewEscalations() {
  const policies = await EscalationPolicy.find({ enabled: true });
  for (const policy of policies) {
    const medicines = await Medicine.find({ familyId: policy.familyId });
    for (const med of medicines) {
      if (!isMissed(med)) continue;
      const exists = await EscalationEvent.findOne({ medicineId: med._id, scheduledDate: todayStr() });
      if (exists) continue;
      await startEscalation(med, policy).catch(err => console.error('startEscalation failed:', err.message));
    }
  }
}

async function startEscalation(medicine, policy) {
  const circle = await CareCircle.findById(medicine.familyId);
  if (!circle) return null;

  const event = await EscalationEvent.create({
    familyId: medicine.familyId,
    medicineId: medicine._id,
    medicineName: medicine.name,
    scheduledDate: todayStr(),
    policySnapshot: policy.toObject(),
    phase: 'reminders',
    reminderCount: 0,
    stepIndex: -1,
    nextActionAt: new Date(), // fire the first reminder immediately
    status: 'active',
    log: [{ phase: 'reminders', label: `Missed dose detected — starting escalation for ${medicine.name}`, notified: false }],
  });

  await addActivity(medicine.familyId, 'medicine', `${medicine.name} was missed — escalation started`);
  await advanceEscalation(event._id); // fire reminder #1 right away instead of waiting for the next poll tick
  return event;
}

// ---- advancing an existing run -------------------------------------------

async function advanceEscalation(eventId) {
  const event = await EscalationEvent.findById(eventId);
  if (!event || event.status !== 'active') return;

  const medicine = await Medicine.findById(event.medicineId);
  // The medicine was deleted out from under an in-flight escalation —
  // nothing sensible left to do but stop.
  if (!medicine) { event.status = 'resolved'; event.resolution = 'acknowledged'; await event.save(); return; }

  const policy = event.policySnapshot;

  if (event.phase === 'reminders') {
    if (event.reminderCount < policy.reminderRepeatCount) {
      const seniorMembers = (await CareCircle.findById(event.familyId))?.members.filter(m => m.status === 'active' && m.role === 'senior').map(m => m.userId) || [];
      event.reminderCount += 1;
      await pushToUserIds(event.familyId, seniorMembers, {
        title: '💊 Caretaker24',
        body: `Reminder ${event.reminderCount} of ${policy.reminderRepeatCount}: it's time for ${medicine.name}.`,
        data: { kind: 'medicine', medId: medicine._id.toString() },
        categoryId: 'MEDICINE_REMINDER',
      }).catch(() => {});
      event.log.push({ phase: 'reminders', label: `Reminder ${event.reminderCount} of ${policy.reminderRepeatCount} sent`, notified: seniorMembers.length > 0 });
      event.nextActionAt = minutesFromNow(policy.reminderIntervalMinutes);
      await event.save();
      return;
    }
    // Reminders exhausted — move into the escalation chain, if one exists.
    if (!policy.steps || !policy.steps.length) {
      event.phase = 'exhausted';
      event.status = 'exhausted';
      event.log.push({ phase: 'exhausted', label: 'No escalation contacts configured — reminders exhausted with no response', notified: false });
      await event.save();
      await addActivity(event.familyId, 'medicine', `${medicine.name}: reminders exhausted, no one to escalate to`);
      return;
    }
    event.phase = 'escalating';
    event.stepIndex = 0;
  } else if (event.phase === 'escalating') {
    event.stepIndex += 1;
  } else {
    return; // resolved/exhausted — nothing to advance
  }

  const step = policy.steps[event.stepIndex];
  if (!step) {
    event.phase = 'exhausted';
    event.status = 'exhausted';
    event.log.push({ phase: 'exhausted', label: 'Escalation chain exhausted — no one responded', notified: false });
    await event.save();
    await addActivity(event.familyId, 'medicine', `${medicine.name}: escalation exhausted — nobody responded`);
    return;
  }

  const target = await resolveStepTarget(step);
  if (target.deliverable) {
    await pushToUserIds(event.familyId, target.userIds, {
      title: '⚠️ Missed medicine',
      body: `${medicine.name} was missed and hasn't been acknowledged. You're listed as an emergency contact — please check in.`,
      data: { kind: 'escalation', medId: medicine._id.toString(), eventId: event._id.toString() },
      categoryId: 'ESCALATION_ALERT',
    }).catch(() => {});
  }
  event.log.push({ phase: 'escalating', label: `Notified ${target.label}${target.deliverable ? '' : ' (no app account — log only; consider calling directly)'}`, notified: target.deliverable });
  event.nextActionAt = minutesFromNow(step.waitMinutes);
  await event.save();
  await addActivity(event.familyId, 'medicine', `${medicine.name}: no response — escalated to ${target.label}`);
}

// ---- resolving a run (medicine taken/skipped, or explicitly acknowledged) --

async function resolveEscalationForMedicine(medicineId, resolution, resolvedByUserId) {
  const event = await EscalationEvent.findOne({ medicineId, scheduledDate: todayStr(), status: 'active' });
  if (!event) return null;
  event.status = 'resolved';
  event.phase = 'resolved';
  event.resolvedAt = new Date();
  event.resolvedBy = resolvedByUserId || null;
  event.resolution = resolution;
  event.log.push({ phase: 'resolved', label: `Resolved (${resolution})`, notified: false });
  await event.save();
  return event;
}

// ---- the poll tick, called by escalationScheduler.js ---------------------

async function runEscalationTick() {
  await scanAndStartNewEscalations();
  const due = await EscalationEvent.find({ status: 'active', nextActionAt: { $lte: new Date() } });
  for (const event of due) {
    await advanceEscalation(event._id).catch(err => console.error('advanceEscalation failed:', err.message));
  }
}

module.exports = {
  isMissed, startEscalation, advanceEscalation, resolveEscalationForMedicine,
  scanAndStartNewEscalations, runEscalationTick,
};
