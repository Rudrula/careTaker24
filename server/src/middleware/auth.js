const jwt = require('jsonwebtoken');
const User = require('../models/User');
const CareCircle = require('../models/CareCircle');

async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Missing Authorization bearer token.' });

    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    const user = await User.findById(payload.sub);
    if (!user) return res.status(401).json({ error: 'User not found.' });
    req.user = user;

    // req.family / req.role keep their original shape and meaning on
    // purpose — every pre-existing route (medicines, bills, contacts,
    // reports, activity, devices, alerts, ai, payments) reads these two
    // fields and needs zero changes now that "the" family has become
    // "whichever CareCircle is currently active." Only auth.js and the new
    // careCircles.js / invitations.js routes need to know CareCircle
    // exists at all.
    const activeId = user.activeCareCircleId;
    let circle = null;
    if (activeId) {
      circle = await CareCircle.findOne({ _id: activeId, status: 'active', 'members.userId': user._id, 'members.status': 'active' });
    }
    if (!circle) {
      // Active circle was never set, or is stale (archived/deleted/left) —
      // fall back to the user's oldest active membership and persist that
      // as the new active circle so this lookup isn't repeated every request.
      circle = await CareCircle.findOne({ 'members.userId': user._id, 'members.status': 'active', status: 'active' }).sort({ createdAt: 1 });
      if (circle) {
        user.activeCareCircleId = circle._id;
        await user.save();
      }
    }
    if (circle) {
      req.family = circle;
      req.role = circle.members.find(m => m.userId.equals(user._id) && m.status === 'active').role;
    }
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

function requireFamily(req, res, next) {
  if (!req.family) return res.status(409).json({ error: 'No active Care Circle. Create or join one first.' });
  next();
}

module.exports = { authenticate, requireFamily };
