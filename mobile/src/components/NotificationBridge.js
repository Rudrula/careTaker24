import { useEffect } from 'react';
import { Alert } from 'react-native';
import { useData } from '../context/DataContext';
import {
  addPushReceivedListener, addPushResponseListener,
} from '../services/pushService';
import * as Notifications from 'expo-notifications';
import {
  MEDICINE_ACTION_TAKE, MEDICINE_ACTION_SKIP, MEDICINE_ACTION_POSTPONE, ESCALATION_ACTION_ACKNOWLEDGE,
} from '../services/notificationService';
import { acknowledgeEscalation } from '../services/escalationService';

// Renders nothing — this is a side-effect-only component whose entire job
// is wiring OS notification interactions to app state. It must be rendered
// INSIDE <DataProvider> (so useData() is available) but doesn't need to be
// inside navigation, since none of this depends on which screen is visible.
export default function NotificationBridge() {
  const { data, markTaken, skipMedicine, postponeMedicine } = useData();

  useEffect(() => {
    // Handles taps on the Take/Skip/Postpone buttons that appear directly
    // on the notification itself (see notificationService.js's
    // MEDICINE_REMINDER category), AND the Smart Escalation Engine's
    // "I've got this ✓" acknowledge button (ESCALATION_ALERT category) —
    // both fire even if the app was fully closed, since the OS launches it
    // briefly in the background to run this handler.
    const medicineActionSub = Notifications.addNotificationResponseReceivedListener(response => {
      const { actionIdentifier, notification } = response;
      const { medId, medName, kind, eventId } = notification.request.content.data || {};

      if (kind === 'escalation') {
        if (actionIdentifier === ESCALATION_ACTION_ACKNOWLEDGE && eventId) {
          acknowledgeEscalation(eventId).catch(() => {});
        }
        return;
      }

      if (kind !== 'medicine' || !medId) return;

      const med = data.medicines.find(m => m.id === medId) || { id: medId, name: medName || 'medicine', dosage: '' };

      if (actionIdentifier === MEDICINE_ACTION_TAKE) {
        markTaken(med);
      } else if (actionIdentifier === MEDICINE_ACTION_SKIP) {
        skipMedicine(med);
      } else if (actionIdentifier === MEDICINE_ACTION_POSTPONE) {
        postponeMedicine(med, 15);
      }
      // actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER means
      // the person tapped the notification body itself (not a button) —
      // no action needed here; they'll just land in the app normally.
    });

    // SOS push arriving while the app is open (family member's phone).
    const receivedSub = addPushReceivedListener(notification => {
      const { title, body, data: pushData } = notification.request.content;
      if (pushData?.kind === 'sos') {
        Alert.alert(title || 'SOS Alert', body || 'A family member needs help.');
      }
    });

    // SOS push tapped from the notification tray.
    const responseSub = addPushResponseListener(response => {
      const pushData = response.notification.request.content.data;
      if (pushData?.kind === 'sos') {
        // Could deep-link to the Contacts tab here via a navigation ref if
        // desired — left as a no-op since the app already opens to Home,
        // where the SOS banner/activity log makes the alert visible.
      }
    });

    return () => {
      medicineActionSub.remove();
      receivedSub.remove();
      responseSub.remove();
    };
  }, [data.medicines, markTaken, skipMedicine, postponeMedicine]);

  return null;
}
