const express = require('express');
const ActivityLog = require('../models/ActivityLog');
const { authenticate, requireFamily } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate, requireFamily);

router.get('/', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 30, 100);
    res.json(await ActivityLog.find({ familyId: req.family._id }).sort({ ts: -1 }).limit(limit));
  } catch (err) { next(err); }
});

module.exports = router;
