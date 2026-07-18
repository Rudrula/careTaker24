import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Platform } from 'react-native';
import { API_BASE_URL } from '../config';

WebBrowser.maybeCompleteAuthSession();

// ---- Google ----
// Create three OAuth client IDs in Google Cloud Console (console.cloud.google.com
// → APIs & Services → Credentials → Create OAuth client ID): one "Web
// application" client (used for the Expo proxy / dev), one "iOS" client, and
// one "Android" client. Paste them below. The web client secret stays on
// your BACKEND only — never put it in the app.
export const GOOGLE_CLIENT_IDS = {
  expo: 'REPLACE_WITH_YOUR_WEB_CLIENT_ID.apps.googleusercontent.com',
  ios: 'REPLACE_WITH_YOUR_IOS_CLIENT_ID.apps.googleusercontent.com',
  android: 'REPLACE_WITH_YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com',
};

const discovery = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

// Call this from a component with the `useGoogleAuthRequest` hook below —
// OAuth flows in Expo need the request built with a React hook so the
// redirect URI matches what's registered with Google.
export function getGoogleClientId() {
  if (Platform.OS === 'ios') return GOOGLE_CLIENT_IDS.ios;
  if (Platform.OS === 'android') return GOOGLE_CLIENT_IDS.android;
  return GOOGLE_CLIENT_IDS.expo;
}

export { AuthSession, discovery };

// Exchanges the Google id_token for your OWN backend's JWT pair. The backend
// verifies the id_token against Google's public keys server-side — the app
// never trusts the token by itself.
export async function exchangeGoogleToken(idToken) {
  const res = await fetch(`${API_BASE_URL}/api/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  if (!res.ok) throw new Error('Google sign-in failed on the server.');
  return res.json(); // { accessToken, refreshToken, user }
}

// ---- Apple ----
// Apple Sign In only works on physical iOS devices / iOS 13+ (and requires
// the "Sign In with Apple" capability enabled in your Apple Developer
// account + Xcode project, which EAS handles automatically when the
// expo-apple-authentication plugin is present, as configured in app.json).
export async function isAppleAuthAvailable() {
  if (Platform.OS !== 'ios') return false;
  return AppleAuthentication.isAvailableAsync();
}

export async function signInWithApple() {
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });
  // credential.identityToken is a signed JWT from Apple — send it to your
  // backend to verify against Apple's public keys and mint your own JWT pair.
  const res = await fetch(`${API_BASE_URL}/api/auth/apple`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identityToken: credential.identityToken,
      fullName: credential.fullName,
      email: credential.email,
    }),
  });
  if (!res.ok) throw new Error('Apple sign-in failed on the server.');
  return res.json();
}
