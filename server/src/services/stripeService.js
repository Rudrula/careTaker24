let stripeClient = null;
function getClient() {
  if (!stripeClient) {
    if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY is not set.');
    stripeClient = require('stripe')(process.env.STRIPE_SECRET_KEY);
  }
  return stripeClient;
}

async function createCheckoutSession({ amountCents, currency = 'usd', productName, successUrl, cancelUrl }) {
  return getClient().checkout.sessions.create({
    mode: 'payment',
    line_items: [{ price_data: { currency, unit_amount: amountCents, product_data: { name: productName } }, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
  });
}

function constructWebhookEvent(rawBody, signature) {
  return getClient().webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
}

module.exports = { createCheckoutSession, constructWebhookEvent };
