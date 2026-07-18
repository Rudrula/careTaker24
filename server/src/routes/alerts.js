const express = require('express');
const { authenticate, requireFamily } = require('../middleware/auth');
const { addActivity } = require('../services/activityLogger');
const { pushToRole } = require('../services/pushService');

const router = express.Router();
router.use(authenticate, requireFamily);

router.post('/', async (req, res, next) => {
  try {
    const seniorName = req.family.seniorName || 'Your family member';
    const { lat, lng } = req.body || {};
    const hasLocation = typeof lat === 'number' && typeof lng === 'number';
    const mapsLink = hasLocation ? `https://maps.google.com/?q=${lat},${lng}` : null;

    await addActivity(
      req.family._id, 'emergency',
      hasLocation
        ? `SOS alert triggered by ${seniorName} — family notified — location: ${mapsLink}`
        : `SOS alert triggered by ${seniorName} — family notified — location unavailable`,
    );
    const result = await pushToRole(req.family._id, 'family', {
      title: 'SOS Alert',
      body: hasLocation
        ? `${seniorName} triggered an emergency alert. Tap to see their location.`
        : `${seniorName} triggered an emergency alert. Location wasn't available.`,
      data: { kind: 'sos', ...(hasLocation ? { lat, lng, mapsLink } : {}) },
    });
    res.json({ ok: true, notified: result.sent, mapsLink });
  } catch (err) { next(err); }
});

module.exports = router;
