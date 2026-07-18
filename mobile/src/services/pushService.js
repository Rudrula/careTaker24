import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { API_BASE_URL } from '../config';

// In a managed Expo app, you register for push using Expo's own token
// (not a raw FCM/APNs token). Expo's push service then handles delivery to
// FCM (Android) or APNs (iOS) on your behalf — no need to touch the
// Firebase Admin SDK's messaging module directly, and no google-services.json
// juggling. This is the standard approach unless you eject to bare RN.
export async function registerForPushNotifications() {
  if (!Device.isDevice) return null; // push doesn't work on simulators/emulators

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== 'granted') {
    const req = await Notifications.requestPermissionsAsync();
    status = req.status;
  }
  if (status !== 'granted') return null;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) {
    console.warn('No EAS projectId found — run `eas build:configure` first.');
    return null;
  }

  const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
  return tokenData.data; // e.g. "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]"
}

// Sends the token to your backend so it can push to this specific device
// later (e.g. when the senior taps SOS, every registered family-role device
// gets notified — see the backend's /api/devices and /api/alerts routes,
// which should use the `expo-server-sdk` npm package server-side to
// actually deliver the push).
export async function syncPushTokenWithBackend(token, role, accessToken) {
  if (!token) return;
  try {
    await fetch(`${API_BASE_URL}/api/devices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({ expoPushToken: token, role, platform: Device.osName }),
    });
  } catch (e) {
    // Non-fatal — local reminders still work without push registered.
  }
}

// Foreground listener — fires while the app is open when a push arrives
// (e.g. a family member's phone receiving an SOS alert while the app is
// active). Returns a subscription; call .remove() to stop listening.
export function addPushReceivedListener(handler) {
  return Notifications.addNotificationReceivedListener(handler);
}

// Fires when the user taps a push notification (foreground or background).
export function addPushResponseListener(handler) {
  return Notifications.addNotificationResponseReceivedListener(handler);
}
