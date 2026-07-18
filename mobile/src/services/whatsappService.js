import { Linking, Alert } from 'react-native';

// wa.me is WhatsApp's public "click to chat" link format — no API key, no
// WhatsApp Business account, no server-side integration needed. It opens
// the WhatsApp app with a specific contact's chat pre-filled with the given
// text; the person still has to tap Send themselves inside WhatsApp (this
// is a real platform limitation — fully automated, silent WhatsApp sending
// requires the paid WhatsApp Business Cloud API, a different integration
// entirely). That one extra tap is an acceptable tradeoff for a zero-setup
// integration, and arguably even useful here: it gives the person a moment
// to glance at the message before an emergency alert goes out under their
// name.
export async function openWhatsAppTo(phone, message) {
  const digitsOnly = String(phone || '').replace(/[^\d+]/g, '').replace(/^\+/, '');
  if (!digitsOnly) {
    Alert.alert('No phone number', "This contact doesn't have a phone number saved.");
    return false;
  }
  const url = `https://wa.me/${digitsOnly}?text=${encodeURIComponent(message)}`;
  const supported = await Linking.canOpenURL(url).catch(() => false);
  if (!supported) {
    Alert.alert("WhatsApp isn't installed", 'Install WhatsApp to send this message, or use the in-app alert instead.');
    return false;
  }
  await Linking.openURL(url);
  return true;
}

export function buildSOSMessage(seniorName, mapsLink) {
  const base = `🆘 EMERGENCY: ${seniorName} has triggered an SOS alert on Caretaker24 and may need help right away.`;
  return mapsLink ? `${base}\n\nTheir last known location: ${mapsLink}` : `${base}\n\n(Location unavailable — please try calling them directly.)`;
}
