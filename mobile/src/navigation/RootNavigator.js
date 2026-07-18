import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import OtpScreen from '../screens/auth/OtpScreen';
import BiometricSetupScreen from '../screens/auth/BiometricSetupScreen';
import AppLockScreen from '../screens/auth/AppLockScreen';
import MainTabs from './MainTabs';

const Stack = createNativeStackNavigator();

// Maps caretaker24://invite/:token (what the QR code / share link encodes —
// see InviteToCircleScreen.js) to the AcceptInvite screen nested inside the
// Account tab's stack. Only resolves while `authed` (Main is the only
// screen that exposes this nested path) — if someone taps the link before
// ever signing in, React Navigation simply won't find a match and the app
// opens normally to Login instead of crashing. Full "hold the invite token
// through the sign-up flow, then resolve it" is a reasonable future
// enhancement, not implemented here.
const linking = {
  prefixes: ['caretaker24://', 'https://caretaker24.com'],
  config: {
    screens: {
      Main: {
        screens: {
          Account: {
            screens: {
              AcceptInvite: 'invite/:token',
            },
          },
        },
      },
    },
  },
};

export default function RootNavigator() {
  const { authed, locked, checkingSession } = useAuth();
  const { colors, darkMode } = useTheme();

  if (checkingSession) return null; // could show a splash here

  return (
    <NavigationContainer
      linking={linking}
      theme={{
        dark: darkMode,
        colors: {
          primary: colors.primary, background: colors.bg, card: colors.card,
          text: colors.ink, border: colors.border, notification: colors.rose,
        },
      }}
    >
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!authed ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
            <Stack.Screen name="Otp" component={OtpScreen} />
            <Stack.Screen name="BiometricSetup" component={BiometricSetupScreen} />
          </>
        ) : locked ? (
          // A valid session exists, but it needs a fresh biometric/passcode
          // check before showing any app content — see AuthContext's
          // cold-start and AppState-based re-lock logic for when this fires.
          <Stack.Screen name="AppLock" component={AppLockScreen} />
        ) : (
          <Stack.Screen name="Main" component={MainTabs} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
