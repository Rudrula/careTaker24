// For local development: your phone (running Expo Go) can't reach
// "localhost" — that means the phone itself. Use your computer's LAN IP
// instead, e.g. "http://192.168.1.42:4000" (find it with `ipconfig` on
// Windows or `ifconfig`/`ipconfig getifaddr en0` on Mac). Both devices must
// be on the same WiFi network. For a real deployed backend, use its public
// HTTPS URL instead — and make sure that URL is HTTPS, not HTTP, in
// production: access/refresh tokens travel in plaintext over HTTP.
export const API_BASE_URL = 'http://192.168.1.42:4000'; // ← replace with your backend's address
