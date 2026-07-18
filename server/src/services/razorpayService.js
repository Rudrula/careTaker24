const crypto = require('crypto');

let client = null;
function getClient() {
  if (!client) {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) throw new Error('Razorpay keys not set.');
    const Razorpay = require('razorpay');
    client = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
  }
  return client;
}

async function createOrder({ amountPaise, currency = 'INR', receipt }) {
  return getClient().orders.create({ amount: amountPaise, currency, receipt });
}

function verifyPaymentSignature(orderId, paymentId, signature) {
  const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex');
  return expected === signature;
}

module.exports = { createOrder, verifyPaymentSignature };
