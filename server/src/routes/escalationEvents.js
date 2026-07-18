const express = require('express');
const EscalationEvent = require('../models/EscalationEvent');
const { authenticate, requireFamily } = require('../middleware/auth');
const { resolveEscalationForMedicine } = require('../services/escalationService');

const router = express.Router();
router.use(authenticate, requireFamily);

// ?status=active (default) | resolved | exhausted | all
router.get('/', async (req, res, next) => {
  try {
    const { status = 'active', limit = 20 } = req.query;
    const filter = { familyId: req.family._id };
    if (status !== 'all') filter.status = status;
    const events = await EscalationEvent.find(filter).sort({ createdAt: -1 }).limit(Math.min(Number(limit) || 20, 100));
    res.json(events);
  } catch (err) { next(err); }
});

// Lets whoever received a "you're an emergency contact" push stop the
// chain without necessarily being the one who marks the medicine taken —
// e.g. the wife calls the husband directly and confirms he's fine, rather
// than opening his medicine list herself.
router.post('/:id/acknowledge', async (req, res, next) => {
  try {
    const event = await EscalationEvent.findOne({ _id: req.params.id, familyId: req.family._id });
    if (!event) return res.status(404).json({ error: 'Escalation event not found.' });
    if (event.status !== 'active') return res.status(409).json({ error: `This escalation was already ${event.status}.` });
    const resolved = await resolveEscalationForMedicine(event.medicineId, 'acknowledged', req.user._id);
    res.json(resolved);
  } catch (err) { next(err); }
});

module.exports = router;
