import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { medicineFormIcon } from '../utils/medicineForm';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const ANDROID_CHANNEL_ID = 'caretaker24-alarms';

// Action identifiers — these are what `response.actionIdentifier` equals in
// the response listener wired up in components/NotificationBridge.js.
export const MEDICINE_ACTION_TAKE = 'MEDICINE_TAKE';
export const MEDICINE_ACTION_SKIP = 'MEDICINE_SKIP';
export const MEDICINE_ACTION_POSTPONE = 'MEDICINE_POSTPONE'; // labelled "Snooze" on the notification itself, see below
const MEDICINE_CATEGORY = 'MEDICINE_REMINDER';
const SNOOZE_MINUTES = 15;

// Escalation alerts ("You're listed as an emergency contact — please
// check in") are pushed server-side by the Smart Escalation Engine — see
// server/src/services/escalationService.js. A single acknowledge action
// lets whoever received it stop the chain right from the notification,
// without needing to open the app first.
export const ESCALATION_ACTION_ACKNOWLEDGE = 'ESCALATION_ACKNOWLEDGE';
const ESCALATION_CATEGORY = 'ESCALATION_ALERT';

export async function configureNotifications() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: 'Medicine & bill alarms',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'alarm.wav',
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#1A2856',
    });
  }

  // Button order matches familiar medicine-reminder apps (Skip · Snooze ·
  // Take, left to right) so the layout feels immediately recognizable.
  // `opensAppToForeground: false` on all three means tapping any of them
  // fires the response listener silently in the background — no reason to
  // interrupt someone's day just to confirm what they already told the
  // notification directly.
  await Notifications.setNotificationCategoryAsync(MEDICINE_CATEGORY, [
    { identifier: MEDICINE_ACTION_SKIP, buttonTitle: 'Skip', options: { opensAppToForeground: false } },
    { identifier: MEDICINE_ACTION_POSTPONE, buttonTitle: 'Snooze', options: { opensAppToForeground: false } },
    { identifier: MEDICINE_ACTION_TAKE, buttonTitle: 'Take', options: { opensAppToForeground: false } },
  ]);

  await Notifications.setNotificationCategoryAsync(ESCALATION_CATEGORY, [
    { identifier: ESCALATION_ACTION_ACKNOWLEDGE, buttonTitle: "I've got this ✓", options: { opensAppToForeground: false } },
  ]);
}

export async function requestNotificationPermission() {
  if (!Device.isDevice) return false;
  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== 'granted') {
    const req = await Notifications.requestPermissionsAsync();
    status = req.status;
  }
  return status === 'granted';
}

// Builds the two-line body Medisafe-style notifications use: a direct
// question naming the exact time and medicine, then a short nudge below
// it. The medicine's `form` (tablet/capsule/liquid/injection/drops/
// inhaler) picks the emoji prefix — Expo/Android don't allow swapping the
// actual notification icon per-notification without native drawable
// resources (which needs a custom dev-client build, out of scope for a
// managed app), so prefixing the right emoji directly into the title is
// the practical, fully-portable equivalent: an elderly user scanning
// several stacked reminders can still tell a pill apart from an injection
// or eye drops at a glance.
function buildReminderContent(med) {
  const icon = medicineFormIcon(med.form);
  return {
    title: `${icon} Caretaker24`,
    body: `Have you taken your ${fmtTime12h(med.time)} ${med.name} yet?\nDon't forget to mark as taken.`,
  };
}

function fmtTime12h(time24) {
  const [h, m] = (time24 || '08:00').split(':').map(Number);
  const h12 = h % 12 || 12;
  const ampm = h >= 12 ? 'pm' : 'am';
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

export async function scheduleMedicineReminder(med) {
  await cancelReminder(`med-${med.id}`);
  const [hour, minute] = (med.time || '08:00').split(':').map(Number);
  const { title, body } = buildReminderContent(med);
  await Notifications.scheduleNotificationAsync({
    identifier: `med-${med.id}`,
    content: {
      title, body,
      sound: Platform.OS === 'ios' ? 'alarm.wav' : undefined,
      categoryIdentifier: MEDICINE_CATEGORY,
      data: { kind: 'medicine', medId: med.id, medName: med.name },
      ...(Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL_ID } : {}),
    },
    trigger: { hour, minute, repeats: true },
  });
}

// Fires a one-off reminder N minutes from now for a medicine the person
// tapped "Snooze" on — separate from the daily recurring schedule above,
// so tomorrow's alarm still fires at the normal time regardless.
export async function schedulePostponedReminder(med, minutes = SNOOZE_MINUTES) {
  const { title, body } = buildReminderContent(med);
  await Notifications.scheduleNotificationAsync({
    identifier: `med-postpone-${med.id}-${Date.now()}`,
    content: {
      title, body,
      sound: Platform.OS === 'ios' ? 'alarm.wav' : undefined,
      categoryIdentifier: MEDICINE_CATEGORY,
      data: { kind: 'medicine', medId: med.id, medName: med.name },
      ...(Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL_ID } : {}),
    },
    trigger: { seconds: minutes * 60 },
  });
}

export async function cancelReminder(identifier) {
  await Notifications.cancelScheduledNotificationAsync(identifier).catch(() => {});
}

export async function sendTestAlarm() {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '💊 Caretaker24',
      body: "Have you taken your 8:55 am med yet?\nDon't forget to mark as taken.",
      sound: Platform.OS === 'ios' ? 'alarm.wav' : undefined,
      categoryIdentifier: MEDICINE_CATEGORY,
      ...(Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL_ID } : {}),
    },
    trigger: null,
  });
}
