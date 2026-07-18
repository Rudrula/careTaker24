import { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import { isPedometerAvailable, requestPedometerPermission, watchSteps } from '../services/pedometerService';

/**
 * Encapsulates real device-pedometer tracking: permission request, live
 * subscription, and converting the sensor's "steps since subscription
 * started" counter into incremental deltas that get added to today's
 * running total via `logSteps`.
 *
 * Returns { tracking, toggleTracking } — call toggleTracking() from a
 * button; the hook handles everything else, including cleanly stopping the
 * OS subscription if the component unmounts mid-walk.
 */
export function useStepTracking(logSteps) {
  const [tracking, setTracking] = useState(false);

  useEffect(() => {
    let sub;
    (async () => {
      if (!tracking) return;

      const available = await isPedometerAvailable().catch(() => false);
      if (!available) {
        setTracking(false);
        Alert.alert('Not available', 'Step tracking needs a physical device with motion sensors.');
        return;
      }

      const granted = await requestPedometerPermission();
      if (!granted) {
        setTracking(false);
        Alert.alert(
          'Permission needed',
          'Caretaker24 needs motion & fitness permission to count your steps. You can enable it in your phone\'s Settings.',
        );
        return;
      }

      // watchStepCount's `steps` value is a running count since this
      // subscription started (not the device's all-time step count), so a
      // baseline of 0 correctly captures every step from the very first
      // one — starting the baseline from the first callback's value (the
      // previous version of this code) silently dropped that first step.
      let baseline = 0;
      sub = watchSteps(steps => {
        const delta = steps - baseline;
        if (delta > 0) {
          logSteps(delta);
          baseline = steps;
        }
      });
    })();
    return () => sub?.remove();
  }, [tracking]);

  return { tracking, toggleTracking: () => setTracking(t => !t) };
}
