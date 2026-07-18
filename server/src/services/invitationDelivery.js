// Delivers an invitation via whichever channel it was created for.
// QR and "link" methods don't send anything server-side — the mobile app
// renders the QR locally and the shareable link is just displayed/copied —
// so this module only has real work to do for email/sms/whatsapp.
//
// Every send is wrapped so a missing/misconfigured provider degrades
// gracefully: the invitation record is still created and usable via its
// link, and the API response includes `delivery: { sent: false, reason }`
// instead of failing the whole request — consistent with how the rest of
// this backend treats optional integrations (Twilio, Razorpay, etc.).

let mailTransport = null;
function getMailTransport() {
  if (!mailTransport) {
    if (!process.env.SMTP_HOST) throw new Error('SMTP_HOST is not set.');
    const nodemailer = require('nodemailer');
    mailTransport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
  }
  return mailTransport;
}

function buildInviteMessage({ inviterName, circleName, inviteUrl }) {
  return {
    subject: `${inviterName} invited you to join "${circleName}" on Caretaker24`,
    text: `${inviterName} invited you to join their Care Circle "${circleName}" on Caretaker24.\n\nAccept the invite: ${inviteUrl}\n\nThis link expires in 7 days.`,
  };
}

async function sendEmailInvite({ toEmail, inviterName, circleName, inviteUrl }) {
  try {
    const { subject, text } = buildInviteMessage({ inviterName, circleName, inviteUrl });
    await getMailTransport().sendMail({
      from: process.env.SMTP_FROM || 'Caretaker24 <no-reply@caretaker24.com>',
      to: toEmail, subject, text,
    });
    return { sent: true };
  } catch (e) {
    return { sent: false, reason: e.message };
  }
}

async function sendSmsInvite({ toPhone, inviterName, circleName, inviteUrl }) {
  try {
    if (!process.env.TWILIO_ACCOUNT_SID) throw new Error('Twilio is not configured.');
    const client = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    const { text } = buildInviteMessage({ inviterName, circleName, inviteUrl });
    await client.messages.create({ to: toPhone, from: process.env.TWILIO_SMS_FROM, body: text });
    return { sent: true };
  } catch (e) {
    return { sent: false, reason: e.message };
  }
}

async function sendWhatsAppInvite({ toPhone, inviterName, circleName, inviteUrl }) {
  try {
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_WHATSAPP_FROM) throw new Error('Twilio WhatsApp sender is not configured.');
    const client = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    const { text } = buildInviteMessage({ inviterName, circleName, inviteUrl });
    await client.messages.create({ to: `whatsapp:${toPhone}`, from: `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`, body: text });
    return { sent: true };
  } catch (e) {
    return { sent: false, reason: e.message };
  }
}

async function deliverInvite(invitation, { inviterName, circleName }) {
  const inviteUrl = `${process.env.APP_WEB_URL || 'https://caretaker24.com'}/invite/${invitation.token}`;
  switch (invitation.method) {
    case 'email':
      return { ...(await sendEmailInvite({ toEmail: invitation.targetEmail, inviterName, circleName, inviteUrl })), inviteUrl };
    case 'sms':
      return { ...(await sendSmsInvite({ toPhone: invitation.targetPhone, inviterName, circleName, inviteUrl })), inviteUrl };
    case 'whatsapp':
      return { ...(await sendWhatsAppInvite({ toPhone: invitation.targetPhone, inviterName, circleName, inviteUrl })), inviteUrl };
    case 'qr':
    case 'link':
    default:
      // Nothing to send — the caller displays/shares inviteUrl themselves.
      return { sent: true, inviteUrl, note: 'No delivery needed for this method.' };
  }
}

module.exports = { deliverInvite };
