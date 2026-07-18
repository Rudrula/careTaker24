import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { registerForPushNotifications, syncPushTokenWithBackend } from '../services/pushService';
import { API_BASE_URL } from '../config';
import { setSessionExpiredHandler } from '../services/apiClient';

const AuthContext = createContext(null);

// How long the app can sit in the background before we require a fresh
// biometric unlock on return — short enough to matter for a health app
// (someone picking up a phone left on a table), long enough not to
// re-prompt for a quick app-switch to check a text message.
const RELOCK_AFTER_MS = 30 * 1000;

export function AuthProvider({ children }) {
  const [authed, setAuthed] = useState(false);
  const [locked, setLocked] = useState(false); // true = authed session exists but needs biometric unlock before showing app content
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(true); // hardware + enrollment present on this device right now
  const [checkingSession, setCheckingSession] = useState(true);
  const [userRole, setUserRole] = useState('family'); // senior | family | caregiver

  const backgroundedAtRef = useRef(null);

  async function checkBiometricHardware() {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    const available = hasHardware && isEnrolled;
    setBiometricAvailable(available);
    return available;
  }

  // On cold start: resume a stored session if one exists, and — this is the
  // actual security gate — if biometric lock is on, the resumed session
  // starts LOCKED. A valid token in SecureStore only proves "this device
  // was signed in before," not "the person holding it right now is the
  // account owner." Only a fresh biometric/passcode check proves that.
  useEffect(() => {
    (async () => {
      const [bioFlag, existingAccess] = await Promise.all([
        SecureStore.getItemAsync('biometricEnabled'),
        SecureStore.getItemAsync('accessToken'),
      ]);
      const bioEnabled = bioFlag === 'true';
      setBiometricEnabled(bioEnabled);
      if (existingAccess) {
        setAuthed(true);
        if (bioEnabled) {
          const available = await checkBiometricHardware();
          setLocked(available); // if the device lost biometric capability, fail open to avoid a permanent lockout — see disableBiometric() below for the alternative if you'd rather fail closed
        }
      }
      setCheckingSession(false);
    })();
  }, []);

  // Re-lock after the app has been backgrounded for a while — mirrors how
  // banking apps behave. AppState 'background'/'inactive' covers the phone
  // being locked, another app opened, or the app switcher being used.
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (next) => {
      if (next === 'background' || next === 'inactive') {
        backgroundedAtRef.current = Date.now();
      } else if (next === 'active' && backgroundedAtRef.current) {
        const elapsed = Date.now() - backgroundedAtRef.current;
        backgroundedAtRef.current = null;
        if (authed && biometricEnabled && elapsed > RELOCK_AFTER_MS) {
          const available = await checkBiometricHardware();
          if (available) setLocked(true);
          // If biometrics became unavailable while backgrounded (hardware
          // issue, enrollment wiped), we deliberately do NOT lock the user
          // out with no way back in — biometricAvailable being false means
          // the Profile screen's toggle will show a warning and offer to
          // turn biometric lock off instead.
        }
      }
    });
    return () => sub.remove();
  }, [authed, biometricEnabled]);

  // Let apiClient force us back to the login screen when a refresh
  // ultimately fails (expired/revoked/stolen-and-reused refresh token).
  useEffect(() => {
    setSessionExpiredHandler(() => { setAuthed(false); setLocked(false); });
  }, []);

  // Register for push once signed in AND unlocked — no reason to register
  // a push token for a session that's currently locked out anyway.
  useEffect(() => {
    if (!authed || locked) return;
    (async () => {
      const token = await registerForPushNotifications();
      const accessToken = await SecureStore.getItemAsync('accessToken');
      await syncPushTokenWithBackend(token, userRole, accessToken);
    })();
  }, [authed, locked, userRole]);

  async function signIn(role, tokens) {
    // tokens = { accessToken, refreshToken } returned by the backend's
    // /api/auth/login, /register, /otp/verify, /google, or /apple routes.
    // Both are required — there's no meaningful "signed in" state without a
    // real token pair from the server.
    if (!tokens?.accessToken || !tokens?.refreshToken) {
      throw new Error('signIn() requires a real { accessToken, refreshToken } pair from the backend.');
    }
    await SecureStore.setItemAsync('accessToken', tokens.accessToken);
    await SecureStore.setItemAsync('refreshToken', tokens.refreshToken);
    if (role) setUserRole(role);
    setAuthed(true);
    setLocked(false); // a fresh sign-in already proved identity via password/OTP/OAuth — no need to immediately re-prompt
  }

  // Single-device sign out — revokes THIS device's refresh token
  // server-side (so a copy of it sitting in old memory/logs/backups can't
  // still be used to mint new access tokens) before clearing it locally.
  async function signOut() {
    try {
      const refreshToken = await SecureStore.getItemAsync('refreshToken');
      if (refreshToken) {
        await fetch(`${API_BASE_URL}/api/auth/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
      }
    } catch (e) { /* still clear locally even if the network call fails */ }
    await SecureStore.deleteItemAsync('accessToken');
    await SecureStore.deleteItemAsync('refreshToken');
    setAuthed(false);
    setLocked(false);
  }

  // Every device at once — requires a currently-valid access token
  // (can't be done with just a stolen refresh token, which is intentional:
  // an attacker who only has the refresh token can't lock the real owner
  // out of every other device).
  async function signOutAllDevices() {
    try {
      const accessToken = await SecureStore.getItemAsync('accessToken');
      await fetch(`${API_BASE_URL}/api/auth/logout-all`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    } catch (e) { /* still clear locally even if the network call fails */ }
    await SecureStore.deleteItemAsync('accessToken');
    await SecureStore.deleteItemAsync('refreshToken');
    setAuthed(false);
    setLocked(false);
  }

  async function enableBiometric() {
    const available = await checkBiometricHardware();
    if (!available) return false;
    await SecureStore.setItemAsync('biometricEnabled', 'true');
    setBiometricEnabled(true);
    return true;
  }

  async function disableBiometric() {
    await SecureStore.setItemAsync('biometricEnabled', 'false');
    setBiometricEnabled(false);
    setLocked(false); // nothing left to unlock
  }

  // Called from AppLockScreen. Returns false (rather than throwing) on
  // cancel/failure so the caller can just re-show the unlock screen instead
  // of crashing — biometric prompts are cancelled by users constantly
  // (accidental button press, changed their mind, phone call came in).
  async function unlockApp() {
    const available = await checkBiometricHardware();
    if (!available) return false;
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock Caretaker24',
      fallbackLabel: 'Use passcode', // LocalAuthentication falls back to the device PIN/pattern/passcode automatically when biometry fails or isn't available, unless disableDeviceFallback is set — we deliberately leave that fallback on
      disableDeviceFallback: false,
    });
    if (result.success) { setLocked(false); return true; }
    return false;
  }

  const value = {
    authed, locked, signIn, signOut, signOutAllDevices,
    biometricEnabled, biometricAvailable, enableBiometric, disableBiometric, unlockApp,
    checkingSession, userRole, setUserRole,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
