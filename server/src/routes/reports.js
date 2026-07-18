const express = require('express');
const DailyReport = require('../models/DailyReport');
const Medicine = require('../models/Medicine');
const { authenticate, requireFamily } = require('../middleware/auth');
const { addActivity } = require('../services/activityLogger');

const router = express.Router();
router.use(authenticate, requireFamily);

function todayStr() { return new Date().toISOString().slice(0, 10); }

async function getOrCreateToday(familyId) {
  const date = todayStr();
  let report = await DailyReport.findOne({ familyId, date });
  if (!report) report = await DailyReport.create({ familyId, date });
  return report;
}

router.get('/', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 7, 90);
    const reports = await DailyReport.find({ familyId: req.family._id }).sort({ date: -1 }).limit(limit);
    res.json(reports);
  } catch (err) { next(err); }
});

router.post('/steps', async (req, res, next) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: 'amount must be a positive number.' });
    const report = await getOrCreateToday(req.family._id);
    report.steps = (report.steps || 0) + amount;
    await report.save();
    res.json(report);
  } catch (err) { next(err); }
});

router.post('/water', async (req, res, next) => {
  try {
    const report = await getOrCreateToday(req.family._id);
    report.waterGlasses = (report.waterGlasses || 0) + 1;
    await report.save();
    await addActivity(req.family._id, 'water', 'Logged a glass of water');
    res.json(report);
  } catch (err) { next(err); }
});

router.post('/checkin', async (req, res, next) => {
  try {
    const report = await getOrCreateToday(req.family._id);
    report.checkIns = (report.checkIns || 0) + 1;
    await report.save();
    await addActivity(req.family._id, 'checkin', `${req.family.seniorName} checked in: feeling fine`);
    res.json(report);
  } catch (err) { next(err); }
});

// Called after markTaken on a medicine so today's adherence % stays in sync.
router.post('/sync-adherence', async (req, res, next) => {
  try {
    const meds = await Medicine.find({ familyId: req.family._id });
    const t = todayStr();
    const taken = meds.filter(m => m.lastTakenDate === t).length;
    const total = meds.length;
    const adherence = total ? Math.round((taken / total) * 100) : 100;
    const report = await getOrCreateToday(req.family._id);
    report.taken = taken; report.total = total; report.adherence = adherence;
    await report.save();
    res.json(report);
  } catch (err) { next(err); }
});

module.exports = router;
