const express = require('express');
const Payment = require('../models/Payment');
const { authenticate, requireFamily } = require('../middleware/auth');
const razorpay = require('../services/razorpayService');
const stripe = require('../services/stripeService');

const router = express.Router();
router.use(authenticate, requireFamily);

router.post('/razorpay/order', async (req, res, next) => {
  try {
    const { purpose, amountPaise } = req.body;
    if (!amountPaise) return res.status(400).json({ error: 'amountPaise is required.' });
    const payment = await Payment.create({ familyId: req.family._id, purpose, provider: 'razorpay', amount: amountPaise, currency: 'INR' });
    const order = await razorpay.createOrder({ amountPaise, currency: 'INR', receipt: payment._id.toString() });
    payment.providerOrderId = order.id;
    await payment.save();
    res.status(201).json({ paymentId: payment._id, orderId: order.id, amount: order.amount, currency: order.currency, keyId: process.env.RAZORPAY_KEY_ID });
  } catch (err) { next(err); }
});

router.post('/razorpay/verify', async (req, res, next) => {
  try {
    const { paymentId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const ok = razorpay.verifyPaymentSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
    const payment = await Payment.findOne({ _id: paymentId, familyId: req.family._id });
    if (!payment) return res.status(404).json({ error: 'Payment not found.' });
    payment.status = ok ? 'paid' : 'failed';
    await payment.save();
    if (ok) { req.family.tier = 'basic'; await req.family.save(); } // adjust per actual plan purchased
    res.json(payment);
  } catch (err) { next(err); }
});

router.post('/stripe/checkout', async (req, res, next) => {
  try {
    const { purpose, amountCents, productName, successUrl, cancelUrl } = req.body;
    if (!amountCents) return res.status(400).json({ error: 'amountCents is required.' });
    const payment = await Payment.create({ familyId: req.family._id, purpose, provider: 'stripe', amount: amountCents, currency: 'usd' });
    const session = await stripe.createCheckoutSession({ amountCents, productName, successUrl, cancelUrl });
    payment.providerOrderId = session.id;
    payment.providerSessionUrl = session.url;
    await payment.save();
    res.status(201).json({ paymentId: payment._id, checkoutUrl: session.url });
  } catch (err) { next(err); }
});

module.exports = router;

module.exports.stripeWebhookHandler = async (req, res) => {
  try {
    const event = stripe.constructWebhookEvent(req.body, req.headers['stripe-signature']);
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      await Payment.findOneAndUpdate({ providerOrderId: session.id }, { status: 'paid' });
    }
    res.json({ received: true });
  } catch (err) {
    res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` });
  }
};
