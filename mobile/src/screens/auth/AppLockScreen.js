import React, { useEffect, useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Fingerprint } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { Btn } from '../../components/UI';

export default function AppLockScreen() {
  const { colors } = useTheme();
  const { unlockApp, biometricAvailable, signOut } = useAuth();
  const [attempting, setAttempting] = useState(false);

  async function tryUnlock() {
    setAttempting(true);
    try {
      const ok = await unlockApp();
      // Silently retry-able on failure — a cancelled/failed biometric
      // prompt is extremely common (accidental tap, phone call, changed
      // their mind) and shouldn't feel like an error state.
      if (!ok) { /* stay on this screen, "Unlock" button remains tappable */ }
    } finally {
      setAttempting(false);
    }
  }

  // Prompt automatically as soon as this screen appears — better than
  // making the person tap once just to see a button that immediately
  // triggers the exact same prompt.
  useEffect(() => { tryUnlock(); }, []);

  function handleSignOutInstead() {
    Alert.alert(
      'Sign out?',
      'This ends your session on this device. You can sign back in with your password, OTP, or Google/Apple.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign out', style: 'destructive', onPress: () => signOut() },
      ],
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', padding: 24 }}>
      <View style={{ alignItems: 'center' }}>
        <View style={{ width: 96, height: 96, borderRadius: 99, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
          <Fingerprint size={44} color={colors.primary} />
        </View>
        <Text style={{ fontSize: 20, fontWeight: '800', color: colors.ink, marginBottom: 8 }}>Caretaker24 is locked</Text>
        <Text style={{ fontSize: 13, color: colors.muted, textAlign: 'center', marginBottom: 32, lineHeight: 19 }}>
          {biometricAvailable
            ? 'Use Face ID, Touch ID, or your fingerprint to continue.'
            : "Biometric unlock isn't available on this device right now — sign out and back in to continue."}
        </Text>

        {biometricAvailable && (
          <Btn full loading={attempting} onPress={tryUnlock} style={{ marginBottom: 14 }}>
            Unlock
          </Btn>
        )}

        <Text onPress={handleSignOutInstead} style={{ color: colors.muted, fontSize: 13, textDecorationLine: 'underline' }}>
          Sign out instead
        </Text>
      </View>
    </SafeAreaView>
  );
}
