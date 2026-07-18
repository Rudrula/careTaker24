const express = require('express');
const CareCircle = require('../models/CareCircle');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// Kept for backward compatibility with the original single-household flow
// (register/onboarding screens) — creates a new CareCircle and makes it
// the caller's active one. For creating additional circles as an
// already-onboarded user, see POST /api/care-circles instead, which
// supports templates, custom names/icons, and doesn't require the caller
// to have zero existing circles.
router.post('/', async (req, res, next) => {
  try {
    const { role = 'senior', seniorName } = req.body;
    const circle = await CareCircle.create({
      name: seniorName ? `${seniorName}'s Care` : 'My Care',
      ownerId: req.user._id,
      seniorName: seniorName || req.user.name,
      members: [{ userId: req.user._id, role, permissions: CareCircle.OWNER_PERMISSIONS, isPrimaryContact: true }],
    });
    req.user.activeCareCircleId = circle._id;
    await req.user.save();
    res.status(201).json(circle);
  } catch (err) { next(err); }
});

router.post('/join', async (req, res, next) => {
  try {
    const { inviteCode, role = 'family' } = req.body;
    const circle = await CareCircle.findOne({ inviteCode: String(inviteCode || '').toUpperCase(), status: 'active' });
    if (!circle) return res.status(404).json({ error: 'No Care Circle found with that invite code.' });
    const already = circle.members.find(m => m.userId.equals(req.user._id) && m.status !== 'left' && m.status !== 'removed');
    if (already) return res.status(409).json({ error: 'You are already a member of this Care Circle.' });
    circle.members.push({ userId: req.user._id, role, permissions: CareCircle.DEFAULT_PERMISSIONS });
    await circle.save();
    req.user.activeCareCircleId = circle._id;
    await req.user.save();
    res.json(circle);
  } catch (err) { next(err); }
});

router.get('/me', async (req, res) => {
  if (!req.family) return res.status(409).json({ error: 'No active Care Circle. Create or join one first.' });
  res.json({ family: req.family, role: req.role, user: req.user });
});

router.patch('/me', async (req, res, next) => {
  try {
    if (!req.family) return res.status(409).json({ error: 'No active Care Circle. Create or join one first.' });
    const { seniorName, tier, familyTimezone } = req.body;
    if (seniorName !== undefined) req.family.seniorName = seniorName;
    if (tier !== undefined) req.family.tier = tier;
    if (familyTimezone !== undefined) req.family.familyTimezone = familyTimezone;
    await req.family.save();
    res.json(req.family);
  } catch (err) { next(err); }
});

module.exports = router;
