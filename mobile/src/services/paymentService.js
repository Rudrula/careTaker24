import RazorpayCheckout from 'react-native-razorpay';
import * as WebBrowser from 'expo-web-browser';
import { apiJson } from './apiClient';

function post(path, body) {
  return apiJson(path, { method: 'POST', body: JSON.stringify(body) });
}

// India — opens Razorpay's native checkout UI (UPI, cards, netbanking,
// wallets all handled inside the SDK).
export async function payWithRazorpay({ amountPaise, name, description, userEmail, userPhone }) {
  const order = await post('/api/payments/razorpay/order', { purpose: 'subscription', amountPaise });
  const options = {
    key: order.keyId,
    order_id: order.orderId,
    amount: order.amount,
    currency: order.currency,
    name,
    description,
    prefill: { email: userEmail, contact: userPhone },
    theme: { color: '#1A2856' },
  };
  try {
    const result = await RazorpayCheckout.open(options);
    await post('/api/payments/razorpay/verify', {
      paymentId: order.paymentId,
      razorpay_order_id: result.razorpay_order_id,
      razorpay_payment_id: result.razorpay_payment_id,
      razorpay_signature: result.razorpay_signature,
    });
    return { success: true };
  } catch (e) {
    return { success: false, error: e.description || 'Payment cancelled' };
  }
}

// International — Stripe Checkout has no official RN SDK for this flow, so
// we open its hosted payment page in an in-app browser tab. No card data
// ever touches the app, keeping it out of PCI scope.
export async function payWithStripe({ amountCents, productName, successUrl, cancelUrl }) {
  const session = await post('/api/payments/stripe/checkout', { purpose: 'subscription', amountCents, productName, successUrl, cancelUrl });
  const result = await WebBrowser.openAuthSessionAsync(session.checkoutUrl, successUrl);
  return { success: result.type === 'success' };
}
