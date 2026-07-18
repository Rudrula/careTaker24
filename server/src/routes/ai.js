const express = require('express');
const multer = require('multer');
const { authenticate, requireFamily } = require('../middleware/auth');
const ai = require('../services/anthropicService');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });
router.use(authenticate, requireFamily);

router.post('/chat', async (req, res, next) => {
  try {
    const { messages } = req.body;
    if (!Array.isArray(messages) || !messages.length) return res.status(400).json({ error: 'messages array is required.' });
    const reply = await ai.chat(messages);
    res.json({ reply });
  } catch (err) { next(err); }
});

router.post('/digest', async (req, res, next) => {
  try {
    const summary = await ai.dailyDigest(req.body);
    res.json({ summary });
  } catch (err) { next(err); }
});

// Accepts either multipart (field "photo") or JSON { image: base64, mimeType }
// — the native app currently sends base64 JSON via expo-image-picker.
router.post('/scan-prescription', upload.single('photo'), async (req, res, next) => {
  try {
    let base64, mimeType;
    if (req.file) { base64 = req.file.buffer.toString('base64'); mimeType = req.file.mimetype; }
    else { base64 = req.body.image; mimeType = req.body.mimeType || 'image/jpeg'; }
    if (!base64) return res.status(400).json({ error: 'No image provided.' });
    const medicines = await ai.scanPrescription(base64, mimeType);
    res.json({ medicines });
  } catch (err) { next(err); }
});

router.post('/scan-bill', upload.single('photo'), async (req, res, next) => {
  try {
    let base64, mimeType;
    if (req.file) { base64 = req.file.buffer.toString('base64'); mimeType = req.file.mimetype; }
    else { base64 = req.body.image; mimeType = req.body.mimeType || 'image/jpeg'; }
    if (!base64) return res.status(400).json({ error: 'No image provided.' });
    const bill = await ai.scanBill(base64, mimeType);
    res.json(bill);
  } catch (err) { next(err); }
});

router.post('/voice-intent', async (req, res, next) => {
  try {
    const { text, medicines } = req.body;
    if (!text) return res.status(400).json({ error: 'text is required.' });
    const result = await ai.voiceIntent(text, medicines);
    res.json(result);
  } catch (err) { next(err); }
});

module.exports = router;
