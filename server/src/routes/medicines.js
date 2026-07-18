const express = require('express');
const Medicine = require('../models/Medicine');
const { authenticate, requireFamily } = require('../middleware/auth');
const { addActivity } = require('../services/activityLogger');
const { pushToUserIds } = require('../services/pushService');
const { resolveEscalationForMedicine } = require('../services/escalationService');

const router = express.Router();
router.use(authenticate, requireFamily);

function todayStr() { return new Date().toISOString().slice(0, 10); }

router.get('/', async (req, res, next) => {
  try { res.json(await Medicine.find({ familyId: req.family._id }).sort({ time: 1 })); }
  catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, dosage, time, instructions, purpose, form } = req.body;
    if (!name || !time) return res.status(400).json({ error: 'name and time are required.' });
    if (form && !Medicine.MEDICINE_FORMS.includes(form)) {
      return res.status(400).json({ error: `form must be one of: ${Medicine.MEDICINE_FORMS.join(', ')}` });
    }
    const med = await Medicine.create({ familyId: req.family._id, name, dosage, time, instructions, purpose, form });
    await addActivity(req.family._id, 'medicine', `Added medicine: ${med.name}`);
    res.status(201).json(med);
  } catch (err) { next(err); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const med = await Medicine.findOne({ _id: req.params.id, familyId: req.family._id });
    if (!med) return res.status(404).json({ error: 'Medicine not found.' });
    const { name, dosage, time, instructions, purpose, form, stock } = req.body;
    if (form !== undefined && !Medicine.MEDICINE_FORMS.includes(form)) {
      return res.status(400).json({ error: `form must be one of: ${Medicine.MEDICINE_FORMS.join(', ')}` });
    }
    if (name !== undefined) med.name = name;
    if (dosage !== undefined) med.dosage = dosage;
    if (time !== undefined) med.time = time;
    if (instructions !== undefined) med.instructions = instructions;
    if (purpose !== undefined) med.purpose = purpose;
    if (form !== undefined) med.form = form;
    if (stock !== undefined) med.stock = stock;
    await med.save();
    res.json(med);
  } catch (err) { next(err); }
});

router.patch('/:id/take', async (req, res, next) => {
  try {
    const med = await Medicine.findOneAndUpdate(
      { _id: req.params.id, familyId: req.family._id },
      { lastTakenDate: todayStr(), lastTakenAt: new Date(), lastSkippedDate: null },
      { new: true },
    );
    if (!med) return res.status(404).json({ error: 'Medicine not found.' });
    await addActivity(req.family._id, 'medicine', `${med.name} ${med.dosage} marked taken`);
    await resolveEscalationForMedicine(med._id, 'taken', req.user._id).catch(() => {});
    res.json(med);
  } catch (err) { next(err); }
});

// A "skip" is a deliberate, logged decision not to take today's dose (as
// opposed to "missed," which just means the scheduled time passed with no
// action) — family members can see the difference in the activity feed
// rather than assuming a missed dose was an accident.
router.patch('/:id/skip', async (req, res, next) => {
  try {
    const med = await Medicine.findOneAndUpdate(
      { _id: req.params.id, familyId: req.family._id },
      { lastSkippedDate: todayStr() },
      { new: true },
    );
    if (!med) return res.status(404).json({ error: 'Medicine not found.' });
    await addActivity(req.family._id, 'medicine', `${med.name} ${med.dosage} skipped for today`);
    await resolveEscalationForMedicine(med._id, 'skipped', req.user._id).catch(() => {});
    res.json(med);
  } catch (err) { next(err); }
});

// Alerts whichever circle member(s) are flagged isPrimaryContact — e.g.
// the son who marked himself as the person to notify for "Parents Care."
// There's no cron/scheduler in this backend, so the client (which already
// computes each medicine's "missed" status locally to render the status
// pill) calls this the moment it detects a NEW miss, rather than the
// server polling on a timer. `lastMissedAlertDate` on the medicine guards
// against the client accidentally firing this more than once for the same
// day (e.g. re-render, app restart, multiple family members' apps open).
router.post('/:id/missed-alert', async (req, res, next) => {
  try {
    const med = await Medicine.findOne({ _id: req.params.id, familyId: req.family._id });
    if (!med) return res.status(404).json({ error: 'Medicine not found.' });

    const today = todayStr();
    if (med.lastTakenDate === today || med.lastSkippedDate === today) {
      return res.status(409).json({ error: 'This dose was already taken or skipped — not actually missed.' });
    }
    if (med.lastMissedAlertDate === today) {
      return res.json({ ok: true, alreadySent: true, notified: 0 });
    }

    // If this circle has the Smart Escalation Engine turned on, it already
    // owns the entire missed-dose notification lifecycle (reminders, then
    // the configured notify chain) — firing this simpler single-shot alert
    // as well would mean the primary contact gets two different, slightly
    // conflicting notifications for the same missed dose.
    const EscalationPolicy = require('../models/EscalationPolicy');
    const activePolicy = await EscalationPolicy.findOne({ familyId: req.family._id, enabled: true });
    if (activePolicy) {
      return res.json({ ok: true, deferredToEscalationEngine: true, notified: 0 });
    }

    let targets = req.family.members.filter(m => m.status === 'active' && m.isPrimaryContact).map(m => m.userId);
    // No one explicitly designated? Fall back to the owner rather than
    // silently sending nothing — a missed dose should never go unnoticed
    // just because nobody got around to picking a primary contact.
    if (!targets.length) targets = [req.family.ownerId];

    const seniorName = req.family.seniorName || 'A family member';
    const result = await pushToUserIds(req.family._id, targets, {
      title: 'Missed medicine',
      body: `${seniorName} missed ${med.name} ${med.dosage} (scheduled ${med.time}).`,
      data: { kind: 'missed_dose', medId: med._id.toString(), careCircleId: req.family._id.toString() },
    });

    med.lastMissedAlertDate = today;
    await med.save();
    await addActivity(req.family._id, 'medicine', `${med.name} ${med.dosage} missed — primary contact notified`);
    res.json({ ok: true, notified: result.sent });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try { await Medicine.deleteOne({ _id: req.params.id, familyId: req.family._id }); res.status(204).end(); }
  catch (err) { next(err); }
});

module.exports = router;
