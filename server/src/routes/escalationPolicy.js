const express = require('express');
const mongoose = require('mongoose');
const EscalationPolicy = require('../models/EscalationPolicy');
const Contact = require('../models/Contact');
const { authenticate, requireFamily } = require('../middleware/auth');
const { addActivity } = require('../services/activityLogger');

const router = express.Router();
router.use(authenticate, requireFamily);

function canManage(req) {
  if (req.family.ownerId.equals(req.user._id)) return true;
  const m = req.family.members.find(x => x.userId.equals(req.user._id) && x.status === 'active');
  return !!(m && m.permissions?.canManageMembers);
}

router.get('/', async (req, res, next) => {
  try {
    let policy = await EscalationPolicy.findOne({ familyId: req.family._id });
    if (!policy) {
      // No configuration yet — return a sensible, disabled-by-default
      // shape rather than a 404, so the mobile settings screen always has
      // something to render and edit.
      policy = { familyId: req.family._id, enabled: false, reminderRepeatCount: 3, reminderIntervalMinutes: 10, steps: [] };
    }
    res.json(policy);
  } catch (err) { next(err); }
});

// Full replace, not a partial patch — the ordered `steps` array is edited
// as a whole from the mobile builder UI (add/remove/reorder), so there's
// no meaningful "patch one field" case worth supporting separately.
router.put('/', async (req, res, next) => {
  try {
    if (!canManage(req)) return res.status(403).json({ error: 'You do not have permission to configure escalation for this Care Circle.' });

    const { enabled, reminderRepeatCount, reminderIntervalMinutes, steps } = req.body;

    if (reminderRepeatCount !== undefined && (reminderRepeatCount < 0 || reminderRepeatCount > 10)) {
      return res.status(400).json({ error: 'reminderRepeatCount must be between 0 and 10.' });
    }
    if (reminderIntervalMinutes !== undefined && (reminderIntervalMinutes < 1 || reminderIntervalMinutes > 180)) {
      return res.status(400).json({ error: 'reminderIntervalMinutes must be between 1 and 180.' });
    }

    let cleanSteps = [];
    if (steps !== undefined) {
      if (!Array.isArray(steps)) return res.status(400).json({ error: 'steps must be an array.' });
      if (steps.length > 10) return res.status(400).json({ error: 'A maximum of 10 escalation steps is supported.' });

      for (const [i, s] of steps.entries()) {
        if (!['member', 'contact'].includes(s.targetType)) {
          return res.status(400).json({ error: `Step ${i + 1}: targetType must be "member" or "contact".` });
        }
        if (!s.targetId || !mongoose.isValidObjectId(s.targetId)) {
          return res.status(400).json({ error: `Step ${i + 1}: a valid targetId is required.` });
        }
        if (!s.label || !String(s.label).trim()) {
          return res.status(400).json({ error: `Step ${i + 1}: a label is required.` });
        }
        const waitMinutes = s.waitMinutes === undefined ? 15 : Number(s.waitMinutes);
        if (!Number.isFinite(waitMinutes) || waitMinutes < 1 || waitMinutes > 1440) {
          return res.status(400).json({ error: `Step ${i + 1}: waitMinutes must be between 1 and 1440.` });
        }

        // Verify the target genuinely exists in this circle — a step
        // pointing at a removed member or deleted contact would silently
        // no-op forever, which is worse than rejecting it up front.
        if (s.targetType === 'member') {
          const isMember = req.family.members.some(m => m.userId.equals(s.targetId) && m.status === 'active');
          if (!isMember) return res.status(400).json({ error: `Step ${i + 1}: that person is not an active member of this Care Circle.` });
        } else {
          const contact = await Contact.findOne({ _id: s.targetId, familyId: req.family._id });
          if (!contact) return res.status(400).json({ error: `Step ${i + 1}: that contact was not found in this Care Circle.` });
        }

        cleanSteps.push({ order: i, targetType: s.targetType, targetId: s.targetId, label: String(s.label).trim(), waitMinutes });
      }
    }

    const update = { updatedBy: req.user._id };
    if (enabled !== undefined) update.enabled = !!enabled;
    if (reminderRepeatCount !== undefined) update.reminderRepeatCount = reminderRepeatCount;
    if (reminderIntervalMinutes !== undefined) update.reminderIntervalMinutes = reminderIntervalMinutes;
    if (steps !== undefined) update.steps = cleanSteps;

    const policy = await EscalationPolicy.findOneAndUpdate(
      { familyId: req.family._id },
      { $set: update, $setOnInsert: { familyId: req.family._id } },
      { new: true, upsert: true },
    );

    await addActivity(req.family._id, 'circle', `${req.user.name} updated the missed-medicine escalation settings`);
    res.json(policy);
  } catch (err) { next(err); }
});

module.exports = router;
