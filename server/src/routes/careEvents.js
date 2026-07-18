const express = require('express');
const CareEvent = require('../models/CareEvent');
const { authenticate, requireFamily } = require('../middleware/auth');
const { addActivity } = require('../services/activityLogger');

const router = express.Router();
router.use(authenticate, requireFamily);

router.get('/', async (req, res, next) => {
  try {
    const { includeCompleted } = req.query;
    const filter = { familyId: req.family._id };
    if (!includeCompleted) filter.completed = false;
    res.json(await CareEvent.find(filter).sort({ dueDate: 1 }));
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const { title, type, dueDate, notes } = req.body;
    if (!title || !dueDate) return res.status(400).json({ error: 'title and dueDate are required.' });
    if (type && !CareEvent.EVENT_TYPES.includes(type)) {
      return res.status(400).json({ error: `type must be one of: ${CareEvent.EVENT_TYPES.join(', ')}` });
    }
    const event = await CareEvent.create({
      familyId: req.family._id, title, type: type || 'appointment', dueDate, notes: notes || '', createdBy: req.user._id,
    });
    await addActivity(req.family._id, 'circle', `Added upcoming event: ${event.title}`);
    res.status(201).json(event);
  } catch (err) { next(err); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const event = await CareEvent.findOne({ _id: req.params.id, familyId: req.family._id });
    if (!event) return res.status(404).json({ error: 'Event not found.' });
    const { title, type, dueDate, notes, completed } = req.body;
    if (title !== undefined) event.title = title;
    if (type !== undefined) {
      if (!CareEvent.EVENT_TYPES.includes(type)) return res.status(400).json({ error: `type must be one of: ${CareEvent.EVENT_TYPES.join(', ')}` });
      event.type = type;
    }
    if (dueDate !== undefined) event.dueDate = dueDate;
    if (notes !== undefined) event.notes = notes;
    if (completed !== undefined) event.completed = !!completed;
    await event.save();
    res.json(event);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try { await CareEvent.deleteOne({ _id: req.params.id, familyId: req.family._id }); res.status(204).end(); }
  catch (err) { next(err); }
});

module.exports = router;
