const express = require('express');
const CareCircle = require('../models/CareCircle');
const Invitation = require('../models/Invitation');
const { authenticate } = require('../middleware/auth');
const { addActivity } = require('../services/activityLogger');
const { TEMPLATES, getTemplate } = require('../config/careCircleTemplates');

const router = express.Router();
router.use(authenticate);

const MAX_CIRCLES_PER_USER = 20; // soft abuse guard, not a real product limit

// ---- shared helpers ----------------------------------------------------

// Returns the caller's membership record within a circle, or null if
// they're not an ACTIVE member (invited/blocked/left/removed all count as
// "no access" here — each has its own dedicated flow elsewhere).
function getActiveMembership(circle, userId) {
  return circle.members.find(m => m.userId.equals(userId) && m.status === 'active') || null;
}

function isOwner(circle, userId) {
  return circle.ownerId.equals(userId);
}

// Owner always has full rights regardless of their stored permissions
// object (which could theoretically be stale/tampered) — ownership from
// CareCircle.ownerId is the actual source of truth.
function canManageCircle(circle, userId) {
  if (isOwner(circle, userId)) return true;
  const m = getActiveMembership(circle, userId);
  return !!(m && m.permissions?.canManageMembers);
}

// 404 (not 403) for "you're not a member" — deliberately avoids confirming
// a circle with that ID even exists to someone who isn't part of it.
async function loadAccessibleCircle(req, res, { requireManage = false } = {}) {
  const circle = await CareCircle.findOne({ _id: req.params.id, status: { $ne: 'deleted' } });
  if (!circle) { res.status(404).json({ error: 'Care Circle not found.' }); return null; }
  const membership = getActiveMembership(circle, req.user._id);
  if (!membership) { res.status(404).json({ error: 'Care Circle not found.' }); return null; }
  if (requireManage && !canManageCircle(circle, req.user._id)) {
    res.status(403).json({ error: 'You do not have permission to manage this Care Circle.' });
    return null;
  }
  return circle;
}

// Every route that hands a circle back to the client needs the same three
// caller-relative fields (isActive/myRole/isOwner) — the mobile app's
// Settings screen decides which lifecycle actions to show (Delete vs.
// Leave, whether Transfer Ownership appears, etc.) based on `isOwner`
// specifically, so this must be consistent across every response, not just
// the list endpoint, or those UI decisions silently break the moment a
// mutation route returns a bare document instead.
function enrichCircle(circle, user) {
  return {
    ...circle.toJSON(),
    isActive: user.activeCareCircleId?.equals(circle._id) || false,
    myRole: getActiveMembership(circle, user._id)?.role,
    isOwner: isOwner(circle, user._id),
  };
}

// ---- templates -----------------------------------------------------------

router.get('/templates', (_req, res) => res.json(TEMPLATES));

// ---- list / create -------------------------------------------------------

// ?status=active|archived (default: active + archived, excludes deleted)
router.get('/', async (req, res, next) => {
  try {
    const filter = { 'members.userId': req.user._id, 'members.status': 'active', status: { $ne: 'deleted' } };
    if (req.query.status) filter.status = req.query.status;
    const circles = await CareCircle.find(filter).sort({ updatedAt: -1 });
    res.json(circles.map(c => enrichCircle(c, req.user)));
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const existingCount = await CareCircle.countDocuments({ 'members.userId': req.user._id, 'members.status': 'active', status: { $ne: 'deleted' } });
    if (existingCount >= MAX_CIRCLES_PER_USER) {
      return res.status(422).json({ error: `You've reached the maximum of ${MAX_CIRCLES_PER_USER} Care Circles.` });
    }

    const { name, templateId, type, icon, seniorName } = req.body;
    const template = templateId ? getTemplate(templateId) : null;
    if (templateId && !template) return res.status(400).json({ error: `Unknown template "${templateId}".` });

    const finalName = (name || template?.name || 'New Care Circle').trim();
    if (!finalName) return res.status(400).json({ error: 'name is required.' });
    if (finalName.length > 60) return res.status(400).json({ error: 'name must be 60 characters or fewer.' });

    const circle = await CareCircle.create({
      name: finalName,
      type: type || template?.type || 'general',
      icon: icon || template?.icon || '🏠',
      ownerId: req.user._id,
      seniorName: seniorName || req.user.name,
      createdFromTemplate: templateId || null,
      members: [{ userId: req.user._id, role: 'family', permissions: CareCircle.OWNER_PERMISSIONS, isPrimaryContact: true }],
    });
    res.status(201).json(circle);
  } catch (err) { next(err); }
});

// ---- Care Timeline — cross-circle aggregated summary ---------------------
// Registered before /:id on purpose: Express matches routes in order, and
// /:id would otherwise swallow "timeline" as if it were a circle ID.
//
// Every other route in this file operates on ONE circle (whichever
// middleware/auth.js resolved as req.family). This one deliberately
// doesn't use req.family at all — it's the one place in the API that
// looks across every active circle a caregiver belongs to at once, so
// opening the app shows "Dad took his morning medicines, Mom missed her
// afternoon tablet, Wife's check-up is tomorrow" in a single feed instead
// of requiring them to switch circles one at a time to piece it together.
router.get('/timeline', async (req, res, next) => {
  try {
    const Medicine = require('../models/Medicine');
    const CareEvent = require('../models/CareEvent');

    const circles = await CareCircle.find({
      'members.userId': req.user._id, 'members.status': 'active', status: 'active',
    });
    if (!circles.length) return res.json([]);

    const circleIds = circles.map(c => c._id);
    const [allMedicines, allEvents] = await Promise.all([
      Medicine.find({ familyId: { $in: circleIds } }),
      CareEvent.find({ familyId: { $in: circleIds }, completed: false, dueDate: { $lte: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) } }),
    ]);

    const today = new Date().toISOString().slice(0, 10);
    const nowMins = new Date().getHours() * 60 + new Date().getMinutes();
    const items = [];

    for (const circle of circles) {
      const label = circle.seniorName || circle.name;
      const meds = allMedicines.filter(m => m.familyId.equals(circle._id));

      // Missed doses — highest priority, one line per medicine.
      meds.forEach(m => {
        const taken = m.lastTakenDate === today, skipped = m.lastSkippedDate === today;
        const [mh, mm] = (m.time || '').split(':').map(Number);
        const mt = Number.isFinite(mh) ? mh * 60 + mm : null;
        if (!taken && !skipped && mt !== null && nowMins > mt + 30) {
          items.push({
            id: `missed-${m._id}`, severity: 0, icon: '⚠️', type: 'missed_dose',
            text: `${label} missed the ${timeOfDayLabel(mt)} dose of ${m.name}.`,
            circleId: circle._id, circleName: circle.name, circleIcon: circle.icon,
          });
        }
      });

      // Low stock — second priority.
      meds.forEach(m => {
        if (m.stock !== undefined && m.stock !== null && m.stock <= 10) {
          items.push({
            id: `stock-${m._id}`, severity: 1, icon: '💊', type: 'low_stock',
            text: `${label}'s ${m.name} has only ${m.stock} tablet${m.stock === 1 ? '' : 's'} left.`,
            circleId: circle._id, circleName: circle.name, circleIcon: circle.icon,
          });
        }
      });

      // Upcoming events — third priority, soonest first (sorted globally below).
      allEvents.filter(e => e.familyId.equals(circle._id)).forEach(e => {
        const when = relativeDayPhrase(e.dueDate) + (includesTime(e.dueDate) ? ` at ${fmtEventTime(e.dueDate)}` : '');
        const text = e.type === 'vaccination'
          ? `${label}'s ${e.title} is due ${when}.`
          : `${label} has ${startsWithVowelSound(e.title) ? 'an' : 'a'} ${e.title} ${when}.`;
        items.push({
          id: `event-${e._id}`, severity: 2, icon: e.type === 'vaccination' ? '🧪' : '📅', type: 'upcoming_event',
          text, circleId: circle._id, circleName: circle.name, circleIcon: circle.icon, dueDate: e.dueDate,
        });
      });

      // Positive confirmation — only if there's at least one medicine and
      // every single one is already taken today (nothing missed/pending).
      if (meds.length && meds.every(m => m.lastTakenDate === today)) {
        items.push({
          id: `alltaken-${circle._id}`, severity: 3, icon: '✅', type: 'all_taken',
          text: `${label} took all of today's medicines.`,
          circleId: circle._id, circleName: circle.name, circleIcon: circle.icon,
        });
      }
    }

    items.sort((a, b) => a.severity - b.severity || (a.dueDate ? new Date(a.dueDate) - new Date(b.dueDate || 0) : 0));
    res.json(items);
  } catch (err) { next(err); }
});

function timeOfDayLabel(mt) {
  if (mt < 12 * 60) return 'morning';
  if (mt < 17 * 60) return 'afternoon';
  return 'evening';
}
function startsWithVowelSound(title) {
  return /^[aeiou]/i.test((title || '').trim());
}
function includesTime(date) {
  const d = new Date(date);
  return d.getHours() !== 0 || d.getMinutes() !== 0;
}
function fmtEventTime(date) {
  const d = new Date(date);
  const h = d.getHours(), m = d.getMinutes();
  const ap = h >= 12 ? 'PM' : 'AM', h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ap}`;
}
function relativeDayPhrase(date) {
  const d = new Date(date); d.setHours(0, 0, 0, 0);
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const days = Math.round((d - now) / (24 * 60 * 60 * 1000));
  if (days <= 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days < 7) return `in ${days} days`;
  if (days < 14) return 'next week';
  return d.toLocaleDateString('en', { month: 'short', day: 'numeric' });
}

// ---- single circle: get / rename / delete / archive / restore -----------

router.get('/:id', async (req, res, next) => {
  try {
    const circle = await loadAccessibleCircle(req, res);
    if (!circle) return;
    res.json(enrichCircle(circle, req.user));
  } catch (err) { next(err); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const circle = await loadAccessibleCircle(req, res, { requireManage: true });
    if (!circle) return;
    const { name, icon, seniorName, familyTimezone, tier } = req.body;
    if (name !== undefined) {
      const trimmed = String(name).trim();
      if (!trimmed) return res.status(400).json({ error: 'name cannot be empty.' });
      if (trimmed.length > 60) return res.status(400).json({ error: 'name must be 60 characters or fewer.' });
      circle.name = trimmed;
    }
    if (icon !== undefined) circle.icon = icon;
    if (seniorName !== undefined) circle.seniorName = seniorName;
    if (familyTimezone !== undefined) circle.familyTimezone = familyTimezone;
    if (tier !== undefined) circle.tier = tier;
    await circle.save();
    await addActivity(circle._id, 'circle', `${req.user.name} updated the Care Circle settings`);
    res.json(enrichCircle(circle, req.user));
  } catch (err) { next(err); }
});

// Soft delete — recoverable via /restore. Owner only (canDeleteCircle is
// only ever true for the owner by default, but we also hard-check
// ownerId directly in case permissions were ever edited).
router.delete('/:id', async (req, res, next) => {
  try {
    const circle = await CareCircle.findOne({ _id: req.params.id, status: { $ne: 'deleted' } });
    if (!circle || !getActiveMembership(circle, req.user._id)) return res.status(404).json({ error: 'Care Circle not found.' });
    if (!isOwner(circle, req.user._id)) return res.status(403).json({ error: 'Only the owner can delete a Care Circle.' });
    circle.status = 'deleted';
    circle.deletedAt = new Date();
    await circle.save();
    // If this was the caller's active circle, they need a new one selected
    // on next request — auth.js's fallback logic handles that automatically.
    if (req.user.activeCareCircleId?.equals(circle._id)) {
      req.user.activeCareCircleId = null;
      await req.user.save();
    }
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.post('/:id/archive', async (req, res, next) => {
  try {
    const circle = await loadAccessibleCircle(req, res, { requireManage: true });
    if (!circle) return;
    if (circle.status === 'archived') return res.status(409).json({ error: 'This Care Circle is already archived.' });
    circle.status = 'archived';
    circle.archivedAt = new Date();
    await circle.save();
    res.json(enrichCircle(circle, req.user));
  } catch (err) { next(err); }
});

// Restores from either 'archived' or soft-'deleted'. Owner only when
// restoring a deletion (a bigger action than un-archiving, which any
// manager can do).
router.post('/:id/restore', async (req, res, next) => {
  try {
    const circle = await CareCircle.findOne({ _id: req.params.id });
    if (!circle || !getActiveMembership(circle, req.user._id)) return res.status(404).json({ error: 'Care Circle not found.' });
    if (circle.status === 'active') return res.status(409).json({ error: 'This Care Circle is not archived or deleted.' });
    if (circle.status === 'deleted' && !isOwner(circle, req.user._id)) {
      return res.status(403).json({ error: 'Only the owner can restore a deleted Care Circle.' });
    }
    if (circle.status === 'archived' && !canManageCircle(circle, req.user._id)) {
      return res.status(403).json({ error: 'You do not have permission to restore this Care Circle.' });
    }
    circle.status = 'active';
    circle.archivedAt = null;
    circle.deletedAt = null;
    await circle.save();
    res.json(enrichCircle(circle, req.user));
  } catch (err) { next(err); }
});

// Duplicates the circle's structure (name, type, icon, member list with
// fresh roles) — deliberately does NOT copy medicines/bills/contacts/
// reports, since "Parents Care (copy)" starting with someone else's
// medical history would be a real data-integrity/privacy problem, not a
// convenience. The new circle's owner is always the person duplicating it.
router.post('/:id/duplicate', async (req, res, next) => {
  try {
    const circle = await loadAccessibleCircle(req, res, { requireManage: true });
    if (!circle) return;
    const existingCount = await CareCircle.countDocuments({ 'members.userId': req.user._id, 'members.status': 'active', status: { $ne: 'deleted' } });
    if (existingCount >= MAX_CIRCLES_PER_USER) {
      return res.status(422).json({ error: `You've reached the maximum of ${MAX_CIRCLES_PER_USER} Care Circles.` });
    }
    const { includeMembers = false } = req.body;
    const members = [{ userId: req.user._id, role: 'family', permissions: CareCircle.OWNER_PERMISSIONS, isPrimaryContact: true }];
    if (includeMembers) {
      circle.members
        .filter(m => m.status === 'active' && !m.userId.equals(req.user._id))
        .forEach(m => members.push({ userId: m.userId, role: m.role, permissions: CareCircle.DEFAULT_PERMISSIONS, invitedBy: req.user._id }));
    }
    const copy = await CareCircle.create({
      name: `${circle.name} (copy)`,
      type: circle.type,
      icon: circle.icon,
      ownerId: req.user._id,
      seniorName: circle.seniorName,
      familyTimezone: circle.familyTimezone,
      duplicatedFromCircleId: circle._id,
      members,
    });
    res.status(201).json(copy);
  } catch (err) { next(err); }
});

// ---- ownership / membership lifecycle ------------------------------------

router.post('/:id/transfer-ownership', async (req, res, next) => {
  try {
    const circle = await loadAccessibleCircle(req, res);
    if (!circle) return;
    if (!isOwner(circle, req.user._id)) return res.status(403).json({ error: 'Only the current owner can transfer ownership.' });
    const { newOwnerUserId } = req.body;
    if (!newOwnerUserId) return res.status(400).json({ error: 'newOwnerUserId is required.' });
    if (String(newOwnerUserId) === String(req.user._id)) return res.status(400).json({ error: 'You already own this Care Circle.' });
    const newOwnerMember = getActiveMembership(circle, newOwnerUserId);
    if (!newOwnerMember) return res.status(404).json({ error: 'That person is not an active member of this Care Circle.' });

    circle.ownerId = newOwnerUserId;
    newOwnerMember.permissions = CareCircle.OWNER_PERMISSIONS;
    // Previous owner keeps their membership (with regular permissions) —
    // transferring ownership isn't the same as leaving.
    const prevOwnerMember = getActiveMembership(circle, req.user._id);
    if (prevOwnerMember) prevOwnerMember.permissions = CareCircle.DEFAULT_PERMISSIONS;
    await circle.save();
    await addActivity(circle._id, 'circle', `${req.user.name} transferred ownership of the Care Circle`);
    res.json(enrichCircle(circle, req.user));
  } catch (err) { next(err); }
});

// The owner cannot simply "leave" — a circle always needs an owner.
// They must transfer ownership first (or delete the circle entirely).
// Everyone else can always leave; if they were flagged as a primary
// missed-dose contact, that flag is cleared so alerts don't silently go to
// someone who's no longer here to see them.
router.post('/:id/leave', async (req, res, next) => {
  try {
    const circle = await loadAccessibleCircle(req, res);
    if (!circle) return;
    if (isOwner(circle, req.user._id)) {
      return res.status(409).json({ error: 'As the owner, you must transfer ownership to someone else before leaving, or delete the Care Circle instead.' });
    }
    const member = getActiveMembership(circle, req.user._id);
    member.status = 'left';
    member.leftAt = new Date();
    member.isPrimaryContact = false;
    await circle.save();
    if (req.user.activeCareCircleId?.equals(circle._id)) {
      req.user.activeCareCircleId = null;
      await req.user.save();
    }
    await addActivity(circle._id, 'circle', `${req.user.name} left the Care Circle`);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.post('/:id/set-active', async (req, res, next) => {
  try {
    const circle = await loadAccessibleCircle(req, res);
    if (!circle) return;
    req.user.activeCareCircleId = circle._id;
    await req.user.save();
    res.json({ ok: true, activeCareCircleId: circle._id });
  } catch (err) { next(err); }
});

// ---- member management ----------------------------------------------------

router.get('/:id/members', async (req, res, next) => {
  try {
    const circle = await loadAccessibleCircle(req, res);
    if (!circle) return;
    await circle.populate('members.userId', 'name email phone');
    res.json(circle.members.map(m => ({
      userId: m.userId._id, name: m.userId.name, email: m.userId.email, phone: m.userId.phone,
      role: m.role, permissions: m.permissions, status: m.status, isPrimaryContact: m.isPrimaryContact,
      isOwner: circle.ownerId.equals(m.userId._id), joinedAt: m.joinedAt,
    })));
  } catch (err) { next(err); }
});

router.patch('/:id/members/:userId', async (req, res, next) => {
  try {
    const circle = await loadAccessibleCircle(req, res, { requireManage: true });
    if (!circle) return;
    const member = getActiveMembership(circle, req.params.userId);
    if (!member) return res.status(404).json({ error: 'That person is not an active member of this Care Circle.' });
    const { role, permissions, isPrimaryContact } = req.body;
    if (role !== undefined) {
      if (!CareCircle.MEMBER_ROLES.includes(role)) return res.status(400).json({ error: `role must be one of: ${CareCircle.MEMBER_ROLES.join(', ')}` });
      member.role = role;
    }
    if (permissions !== undefined) member.permissions = { ...member.permissions, ...permissions };
    if (isPrimaryContact !== undefined) member.isPrimaryContact = !!isPrimaryContact; // multiple primary contacts are allowed on purpose — e.g. two children who both want missed-dose alerts
    await circle.save();
    res.json(member);
  } catch (err) { next(err); }
});

// Removing a member is a manager action; use POST /:id/leave to remove
// yourself instead — this route deliberately rejects self-removal so the
// two flows (being removed vs. choosing to leave) stay distinguishable in
// the activity log and can't be used to bypass the owner-must-transfer rule.
router.delete('/:id/members/:userId', async (req, res, next) => {
  try {
    const circle = await loadAccessibleCircle(req, res, { requireManage: true });
    if (!circle) return;
    if (String(req.params.userId) === String(req.user._id)) {
      return res.status(400).json({ error: 'Use "Leave Circle" to remove yourself.' });
    }
    if (circle.ownerId.equals(req.params.userId)) {
      return res.status(409).json({ error: 'The owner cannot be removed — transfer ownership first.' });
    }
    const member = getActiveMembership(circle, req.params.userId);
    if (!member) return res.status(404).json({ error: 'That person is not an active member of this Care Circle.' });
    member.status = 'removed';
    member.leftAt = new Date();
    member.isPrimaryContact = false;
    await circle.save();
    await addActivity(circle._id, 'circle', `${req.user.name} removed a member from the Care Circle`);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ---- blocked users ---------------------------------------------------------
// Blocking implies removal — someone blocked for cause shouldn't remain a
// visible "active" member while also being unable to be re-invited.

router.get('/:id/blocked-users', async (req, res, next) => {
  try {
    const circle = await loadAccessibleCircle(req, res, { requireManage: true });
    if (!circle) return;
    const BlockedUser = require('../models/BlockedUser');
    const blocked = await BlockedUser.find({ careCircleId: circle._id }).populate('blockedUserId', 'name email phone');
    res.json(blocked);
  } catch (err) { next(err); }
});

router.post('/:id/block-user', async (req, res, next) => {
  try {
    const circle = await loadAccessibleCircle(req, res, { requireManage: true });
    if (!circle) return;
    const { userId, email, phone, reason } = req.body;
    if (!userId && !email && !phone) return res.status(400).json({ error: 'userId, email, or phone is required.' });
    if (userId && circle.ownerId.equals(userId)) return res.status(409).json({ error: 'The owner cannot be blocked.' });
    if (userId && String(userId) === String(req.user._id)) return res.status(400).json({ error: "You can't block yourself." });

    // If they're currently an active member, blocking also removes them.
    if (userId) {
      const member = getActiveMembership(circle, userId);
      if (member) { member.status = 'blocked'; member.leftAt = new Date(); member.isPrimaryContact = false; await circle.save(); }
    }

    const BlockedUser = require('../models/BlockedUser');
    const existing = await BlockedUser.findOne({
      careCircleId: circle._id,
      $or: [
        ...(userId ? [{ blockedUserId: userId }] : []),
        ...(email ? [{ blockedEmail: String(email).toLowerCase().trim() }] : []),
        ...(phone ? [{ blockedPhone: phone }] : []),
      ],
    });
    if (existing) return res.status(409).json({ error: 'This person is already blocked from this Care Circle.' });

    const block = await BlockedUser.create({
      careCircleId: circle._id, blockedUserId: userId || null,
      blockedEmail: email ? String(email).toLowerCase().trim() : null,
      blockedPhone: phone || null, blockedBy: req.user._id, reason: reason || '',
    });
    res.status(201).json(block);
  } catch (err) { next(err); }
});

router.delete('/:id/block-user/:blockId', async (req, res, next) => {
  try {
    const circle = await loadAccessibleCircle(req, res, { requireManage: true });
    if (!circle) return;
    const BlockedUser = require('../models/BlockedUser');
    await BlockedUser.deleteOne({ _id: req.params.blockId, careCircleId: circle._id });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
