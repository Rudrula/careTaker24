const express = require('express');
const Device = require('../models/Device');
const { authenticate, requireFamily } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate, requireFamily);

router.post('/', async (req, res, next) => {
  try {
    const { expoPushToken, role, platform } = req.body;
    if (!expoPushToken) return res.status(400).json({ error: 'expoPushToken is required.' });
    const device = await Device.findOneAndUpdate(
      { expoPushToken },
      { userId: req.user._id, familyId: req.family._id, role: role || req.role, platform },
      { upsert: true, new: true },
    );
    res.status(201).json(device);
  } catch (err) { next(err); }
});

module.exports = router;
