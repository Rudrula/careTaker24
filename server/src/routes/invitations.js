const express = require('express');
const CareCircle = require('../models/CareCircle');
const Invitation = require('../models/Invitation');
const BlockedUser = require('../models/BlockedUser');
const User = require('../models/User');
const { authenticate } = require('../middleware/auth');
const { addActivity } = require('../services/activityLogger');
const { deliverInvite } = require('../services/invitationDelivery');
const { inviteLimiter } = require('../middleware/rateLimiters');

const router = express.Router();
router.use(authenticate);

function getActiveMembership(circle, userId) {
  return circle.members.find(m => m.userId.equals(userId) && m.status === 'active') || null;
}
function canManageCircle(circle, userId) {
  if (circle.ownerId.equals(userId)) return true;
  const m = getActiveMembership(circle, userId);
  return !!(m && m.permissions?.canManageMembers);
}
function canInvite(circle, userId) {
  if (circle.ownerId.equals(userId)) return true;
  const m = getActiveMembership(circle, userId);
  return !!(m && (m.permissions?.canInviteMembers || m.permissions?.canManageMembers));
}

// Lazily flips a stale 'pending' invite to 'expired' the moment anything
// touches it — there's no cron/job runner in this backend, so expiry is
// evaluated on read/write instead of on a schedule. Functionally identical
// from the client's point of view, zero extra infrastructure needed.
async function resolveExpiry(invitation) {
  if (invitation.status === 'pending' && invitation.expiresAt < new Date()) {
    invitation.status = 'expired';
    await invitation.save();
  }
  return invitation;
}

function normalizeEmail(email) { return email ? String(email).toLowerCase().trim() : null; }

// ---- create ----------------------------------------------------------------

router.post('/', inviteLimiter, async (req, res, next) => {
  try {
    const { careCircleId, method, targetEmail, targetPhone, proposedRole } = req.body;

    if (!careCircleId) return res.status(400).json({ error: 'careCircleId is required.' });
    if (!Invitation.INVITE_METHODS.includes(method)) {
      return res.status(400).json({ error: `method must be one of: ${Invitation.INVITE_METHODS.join(', ')}` });
    }
    if (['email'].includes(method) && !targetEmail) return res.status(400).json({ error: 'targetEmail is required for this method.' });
    if (['phone', 'sms', 'whatsapp'].includes(method) && !targetPhone) return res.status(400).json({ error: 'targetPhone is required for this method.' });

    const circle = await CareCircle.findOne({ _id: careCircleId, status: 'active' });
    if (!circle || !getActiveMembership(circle, req.user._id)) return res.status(404).json({ error: 'Care Circle not found.' });
    if (!canInvite(circle, req.user._id)) return res.status(403).json({ error: 'You do not have permission to invite people to this Care Circle.' });

    const email = normalizeEmail(targetEmail);
    const phone = targetPhone || null;

    // Blocked-user check — checked before anything else so a blocked
    // person can't be re-invited by a different method to route around it.
    if (email || phone) {
      const blocked = await BlockedUser.findOne({
        careCircleId: circle._id,
        $or: [...(email ? [{ blockedEmail: email }] : []), ...(phone ? [{ blockedPhone: phone }] : [])],
      });
      if (blocked) return res.status(403).json({ error: 'This person has been blocked from this Care Circle.' });
    }

    // Already-a-member check — matches against real user accounts by email/phone.
    if (email || phone) {
      const existingUser = await User.findOne({ $or: [...(email ? [{ email }] : []), ...(phone ? [{ phone }] : [])] });
      if (existingUser && getActiveMembership(circle, existingUser._id)) {
        return res.status(409).json({ error: 'This person is already a member of this Care Circle.' });
      }
    }

    // Duplicate-invite detection — an existing pending invite to the same
    // target for the same circle should be resent, not duplicated.
    if (email || phone) {
      const dupe = await Invitation.findOne({
        careCircleId: circle._id, status: 'pending',
        $or: [...(email ? [{ targetEmail: email }] : []), ...(phone ? [{ targetPhone: phone }] : [])],
      });
      if (dupe) return res.status(409).json({ error: 'An invitation to this person is already pending.', existingInvitationId: dupe._id });
    }

    const invitation = await Invitation.create({
      careCircleId: circle._id, invitedBy: req.user._id, method,
      targetEmail: email, targetPhone: phone,
      proposedRole: proposedRole && CareCircle.MEMBER_ROLES.includes(proposedRole) ? proposedRole : 'family',
    });

    const delivery = await deliverInvite(invitation, { inviterName: req.user.name, circleName: circle.name });
    await addActivity(circle._id, 'circle', `${req.user.name} invited someone to join via ${method}`);

    res.status(201).json({ invitation, delivery });
  } catch (err) { next(err); }
});

// ---- list --------------------------------------------------------------

// Invitations for a circle (manager view) — ?status=pending|accepted|rejected|expired|cancelled
router.get('/', async (req, res, next) => {
  try {
    const { careCircleId, status } = req.query;
    if (!careCircleId) return res.status(400).json({ error: 'careCircleId is required.' });
    const circle = await CareCircle.findOne({ _id: careCircleId });
    if (!circle || !getActiveMembership(circle, req.user._id)) return res.status(404).json({ error: 'Care Circle not found.' });
    if (!canManageCircle(circle, req.user._id)) return res.status(403).json({ error: 'You do not have permission to view invitations for this Care Circle.' });

    const filter = { careCircleId };
    if (status) filter.status = status;
    const invitations = await Invitation.find(filter).sort({ createdAt: -1 });
    await Promise.all(invitations.map(resolveExpiry));
    res.json(invitations);
  } catch (err) { next(err); }
});

// Invitations addressed to the current user, matched by their own email/phone —
// backs the "you've been invited" list / accept-reject screen.
router.get('/mine', async (req, res, next) => {
  try {
    const filter = {
      status: 'pending',
      $or: [
        ...(req.user.email ? [{ targetEmail: req.user.email }] : []),
        ...(req.user.phone ? [{ targetPhone: req.user.phone }] : []),
      ],
    };
    if (!filter.$or.length) return res.json([]);
    const invitations = await Invitation.find(filter).sort({ createdAt: -1 }).populate('careCircleId', 'name icon type').populate('invitedBy', 'name');
    await Promise.all(invitations.map(resolveExpiry));
    res.json(invitations.filter(i => i.status === 'pending'));
  } catch (err) { next(err); }
});

// ---- resolve by token (QR / link / email / sms / whatsapp all land here) --

router.get('/token/:token', async (req, res, next) => {
  try {
    const invitation = await Invitation.findOne({ token: req.params.token }).populate('careCircleId', 'name icon type seniorName').populate('invitedBy', 'name');
    if (!invitation) return res.status(404).json({ error: 'Invitation not found.' });
    await resolveExpiry(invitation);
    res.json(invitation);
  } catch (err) { next(err); }
});

router.post('/token/:token/accept', async (req, res, next) => {
  try {
    const invitation = await Invitation.findOne({ token: req.params.token });
    if (!invitation) return res.status(404).json({ error: 'Invitation not found.' });
    await resolveExpiry(invitation);
    if (invitation.status === 'expired') return res.status(410).json({ error: 'This invitation has expired. Ask for a new one.' });
    if (invitation.status !== 'pending') return res.status(409).json({ error: `This invitation was already ${invitation.status}.` });

    const circle = await CareCircle.findOne({ _id: invitation.careCircleId, status: 'active' });
    if (!circle) return res.status(404).json({ error: 'This Care Circle no longer exists.' });

    const blocked = await BlockedUser.findOne({
      careCircleId: circle._id,
      $or: [{ blockedUserId: req.user._id }, ...(req.user.email ? [{ blockedEmail: req.user.email }] : []), ...(req.user.phone ? [{ blockedPhone: req.user.phone }] : [])],
    });
    if (blocked) return res.status(403).json({ error: 'You have been blocked from this Care Circle.' });

    const existing = circle.members.find(m => m.userId.equals(req.user._id));
    if (existing && existing.status === 'active') return res.status(409).json({ error: 'You are already a member of this Care Circle.' });

    if (existing) {
      // Re-joining after having left/been removed — reactivate rather than duplicate.
      existing.status = 'active';
      existing.role = invitation.proposedRole;
      existing.permissions = CareCircle.DEFAULT_PERMISSIONS;
      existing.leftAt = null;
    } else {
      circle.members.push({ userId: req.user._id, role: invitation.proposedRole, permissions: CareCircle.DEFAULT_PERMISSIONS, invitedBy: invitation.invitedBy });
    }
    await circle.save();

    invitation.status = 'accepted';
    invitation.respondedAt = new Date();
    invitation.respondedByUserId = req.user._id;
    await invitation.save();

    if (!req.user.activeCareCircleId) {
      req.user.activeCareCircleId = circle._id;
      await req.user.save();
    }

    await addActivity(circle._id, 'circle', `${req.user.name} accepted an invitation and joined the Care Circle`);
    res.json({ ok: true, careCircle: circle });
  } catch (err) { next(err); }
});

router.post('/token/:token/reject', async (req, res, next) => {
  try {
    const invitation = await Invitation.findOne({ token: req.params.token });
    if (!invitation) return res.status(404).json({ error: 'Invitation not found.' });
    await resolveExpiry(invitation);
    if (invitation.status === 'expired') return res.status(410).json({ error: 'This invitation has already expired.' });
    if (invitation.status !== 'pending') return res.status(409).json({ error: `This invitation was already ${invitation.status}.` });
    invitation.status = 'rejected';
    invitation.respondedAt = new Date();
    invitation.respondedByUserId = req.user._id;
    await invitation.save();
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ---- resend / cancel (manager actions on an existing invitation id) -------

router.post('/:id/resend', inviteLimiter, async (req, res, next) => {
  try {
    const invitation = await Invitation.findById(req.params.id);
    if (!invitation) return res.status(404).json({ error: 'Invitation not found.' });
    const circle = await CareCircle.findById(invitation.careCircleId);
    if (!circle || !canInvite(circle, req.user._id)) return res.status(403).json({ error: 'You do not have permission to resend this invitation.' });
    if (!['pending', 'expired'].includes(invitation.status)) {
      return res.status(409).json({ error: `Cannot resend an invitation that was already ${invitation.status}.` });
    }
    invitation.status = 'pending';
    invitation.expiresAt = new Date(Date.now() + Invitation.INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
    invitation.resendCount += 1;
    invitation.lastSentAt = new Date();
    await invitation.save();
    const delivery = await deliverInvite(invitation, { inviterName: req.user.name, circleName: circle.name });
    res.json({ invitation, delivery });
  } catch (err) { next(err); }
});

router.post('/:id/cancel', async (req, res, next) => {
  try {
    const invitation = await Invitation.findById(req.params.id);
    if (!invitation) return res.status(404).json({ error: 'Invitation not found.' });
    const circle = await CareCircle.findById(invitation.careCircleId);
    if (!circle || !canInvite(circle, req.user._id)) return res.status(403).json({ error: 'You do not have permission to cancel this invitation.' });
    if (invitation.status !== 'pending') return res.status(409).json({ error: `Cannot cancel an invitation that is already ${invitation.status}.` });
    invitation.status = 'cancelled';
    invitation.cancelledAt = new Date();
    invitation.cancelledBy = req.user._id;
    await invitation.save();
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
