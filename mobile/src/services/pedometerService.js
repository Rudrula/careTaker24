import { Pedometer } from 'expo-sensors';

export async function isPedometerAvailable() {
  return Pedometer.isAvailableAsync();
}

// Android 10+ (API 29+) treats step counting as a "dangerous" permission
// (ACTIVITY_RECOGNITION) that must be requested at runtime — declaring it
// in app.json's android.permissions list alone is not enough. Without this
// call, watchStepCount() silently never fires on real Android devices,
// which is why tracking previously appeared to "not work." iOS doesn't
// need this — Core Motion authorization is handled by the system prompt
// tied to NSMotionUsageDescription in Info.plist automatically.
export async function requestPedometerPermission() {
  try {
    const { granted } = await Pedometer.requestPermissionsAsync();
    return granted;
  } catch (e) {
    // Older Expo SDKs / iOS: requestPermissionsAsync may not exist or may
    // not be needed — fall back to treating hardware availability as
    // sufficient rather than blocking tracking entirely.
    return true;
  }
}

// Live step-count subscription — fires on every new step while the app is
// foregrounded. Returns a subscription object; call .remove() to stop.
export function watchSteps(onStepCountUpdate) {
  return Pedometer.watchStepCount(result => {
    onStepCountUpdate(result.steps);
  });
}

// Historical step count for a date range (iOS: works fully in background via
// Core Motion history; Android: works when Google Fit / Health Connect
// permission is granted, otherwise returns 0 and you should rely on
// watchSteps while the app is open).
export async function getStepsBetween(start, end) {
  try {
    const result = await Pedometer.getStepCountAsync(start, end);
    return result.steps;
  } catch (e) {
    return 0;
  }
}

export async function getStepsToday() {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  return getStepsBetween(start, new Date());
}
