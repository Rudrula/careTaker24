import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../config';

// Every authenticated network call in the app should go through `apiFetch`
// below instead of raw `fetch`. It attaches the access token automatically,
// and — critically — transparently refreshes an expired access token (they
// only live 15 minutes, see the backend's tokenService.js) and retries the
// original request exactly once, so the user is never bounced back to the
// login screen just because 15 minutes passed while they were reading a
// medicine label.

let refreshInFlight = null; // single-flight guard: if 5 requests 401 at the
// same moment, only ONE refresh call goes out, and all 5 await the same
// promise — without this guard, concurrent 401s could each try to rotate
// the refresh token, and only the first would succeed (the rest would hit
// "reuse detected" and lock the user out, since rotation invalidates the
// previous token immediately).

// Set by AppNavigator/App.js on startup so this module can force a sign-out
// (clearing tokens, flipping the app back to the login screen) without a
// direct dependency on AuthContext — avoids a circular import between the
// context and the service layer.
let onSessionExpired = () => {};
export function setSessionExpiredHandler(handler) { onSessionExpired = handler; }

async function getAccessToken() { return SecureStore.getItemAsync('accessToken'); }
async function getRefreshToken() { return SecureStore.getItemAsync('refreshToken'); }

async function performRefresh() {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) throw new Error('No refresh token available.');
  const res = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) throw new Error('Refresh failed.');
  const { accessToken, refreshToken: newRefreshToken } = await res.json();
  await SecureStore.setItemAsync('accessToken', accessToken);
  await SecureStore.setItemAsync('refreshToken', newRefreshToken); // rotation — old one is now dead server-side
  return accessToken;
}

async function refreshAccessToken() {
  if (!refreshInFlight) {
    refreshInFlight = performRefresh().finally(() => { refreshInFlight = null; });
  }
  return refreshInFlight;
}

/**
 * Drop-in replacement for fetch() that adds the Bearer token, retries once
 * after a transparent refresh on 401, and forces sign-out if the refresh
 * token itself is invalid/reused/expired (meaning the session is genuinely
 * over, not just the access token).
 */
export async function apiFetch(path, options = {}) {
  const accessToken = await getAccessToken();
  const doFetch = (token) => fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  let res = await doFetch(accessToken);

  if (res.status === 401 && accessToken) {
    try {
      const newAccessToken = await refreshAccessToken();
      res = await doFetch(newAccessToken);
    } catch (e) {
      // Refresh token is dead (expired, revoked, or reuse was detected) —
      // there's no recovering from this without the user signing in again.
      await SecureStore.deleteItemAsync('accessToken');
      await SecureStore.deleteItemAsync('refreshToken');
      onSessionExpired();
      throw new Error('Session expired. Please sign in again.');
    }
  }

  return res;
}

export async function apiJson(path, options = {}) {
  const res = await apiFetch(path, options);
  const body = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error || `Request failed: ${res.status}`);
  return body;
}
