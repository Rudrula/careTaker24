import * as Location from 'expo-location';

// Best-effort only — an SOS alert must never fail or even be delayed just
// because location permission was denied or the GPS fix is slow. Every
// caller of this treats a null return as "send the alert anyway, without a
// location," never as an error worth blocking on.
//
// SOS_LOCATION_TIMEOUT_MS matters more than it looks: expo-location's
// getCurrentPositionAsync has no built-in timeout and can hang indefinitely
// with a poor GPS fix (common indoors) — completely unacceptable for
// something as time-critical as an emergency alert. Racing it against a
// hard timeout guarantees the alert goes out promptly either way.
const SOS_LOCATION_TIMEOUT_MS = 6000;

export async function getCurrentLocationForSOS() {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    let finalStatus = status;
    if (finalStatus !== 'granted') {
      const req = await Location.requestForegroundPermissionsAsync();
      finalStatus = req.status;
    }
    if (finalStatus !== 'granted') return null;

    const position = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('location timeout')), SOS_LOCATION_TIMEOUT_MS)),
    ]);
    return { lat: position.coords.latitude, lng: position.coords.longitude };
  } catch (e) {
    return null;
  }
}

export function googleMapsLink(lat, lng) {
  return `https://maps.google.com/?q=${lat},${lng}`;
}
