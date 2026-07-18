const express = require('express');
const Bill = require('../models/Bill');
const { authenticate, requireFamily } = require('../middleware/auth');
const { addActivity } = require('../services/activityLogger');

const router = express.Router();
router.use(authenticate, requireFamily);

function nextDueDate(ds, recurring) {
  const d = new Date(ds + 'T00:00:00Z');
  if (recurring === 'yearly') d.setUTCFullYear(d.getUTCFullYear() + 1);
  else d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 10);
}

router.get('/', async (req, res, next) => {
  try { res.json(await Bill.find({ familyId: req.family._id }).sort({ dueDate: 1 })); }
  catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, amount, dueDate, recurring } = req.body;
    if (!name || !dueDate) return res.status(400).json({ error: 'name and dueDate are required.' });
    const bill = await Bill.create({ familyId: req.family._id, name, amount, dueDate, recurring });
    await addActivity(req.family._id, 'bill', `Added bill: ${bill.name}`);
    res.status(201).json(bill);
  } catch (err) { next(err); }
});

router.patch('/:id/pay', async (req, res, next) => {
  try {
    const bill = await Bill.findOne({ _id: req.params.id, familyId: req.family._id });
    if (!bill) return res.status(404).json({ error: 'Bill not found.' });
    if (bill.recurring === 'once') bill.paidThisCycle = true;
    else { bill.dueDate = nextDueDate(bill.dueDate, bill.recurring); bill.paidThisCycle = false; }
    await bill.save();
    await addActivity(req.family._id, 'bill', `Paid ${bill.name}`);
    res.json(bill);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try { await Bill.deleteOne({ _id: req.params.id, familyId: req.family._id }); res.status(204).end(); }
  catch (err) { next(err); }
});

module.exports = router;
