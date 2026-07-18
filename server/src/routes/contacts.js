const express = require('express');
const Contact = require('../models/Contact');
const { authenticate, requireFamily } = require('../middleware/auth');
const { addActivity } = require('../services/activityLogger');

const router = express.Router();
router.use(authenticate, requireFamily);

router.get('/', async (req, res, next) => {
  try { res.json(await Contact.find({ familyId: req.family._id }).sort({ createdAt: 1 })); }
  catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, phone, relation } = req.body;
    if (!name || !phone) return res.status(400).json({ error: 'name and phone are required.' });
    const contact = await Contact.create({ familyId: req.family._id, name, phone, relation });
    await addActivity(req.family._id, 'contact', `Added contact: ${contact.name}`);
    res.status(201).json(contact);
  } catch (err) { next(err); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const { name, phone, relation } = req.body;
    const contact = await Contact.findOneAndUpdate(
      { _id: req.params.id, familyId: req.family._id },
      { ...(name && { name }), ...(phone && { phone }), ...(relation && { relation }) },
      { new: true },
    );
    if (!contact) return res.status(404).json({ error: 'Contact not found.' });
    res.json(contact);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try { await Contact.deleteOne({ _id: req.params.id, familyId: req.family._id }); res.status(204).end(); }
  catch (err) { next(err); }
});

module.exports = router;
