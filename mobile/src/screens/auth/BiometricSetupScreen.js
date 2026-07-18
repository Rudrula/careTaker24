import React from 'react';
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { Btn } from '../../components/UI';

export default function BiometricSetupScreen({ route }) {
  const { colors } = useTheme();
  const { enableBiometric, signIn } = useAuth();
  const { tokens, role } = route.params || {};

  async function handleEnable() {
    await enableBiometric();
    await signIn(role, tokens);
  }

  async function handleSkip() {
    await signIn(role, tokens);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', padding: 24 }}>
      <View style={{ backgroundColor: colors.card, borderRadius: 24, padding: 28, borderWidth: 1, borderColor: colors.border, borderTopWidth: 4, borderTopColor: colors.amber }}>
        <View style={{ alignItems: 'center', marginBottom: 24 }}>
          <Text style={{ fontSize: 64, marginBottom: 12 }}>🔐</Text>
          <Text style={{ fontSize: 22, fontWeight: '800', color: colors.ink, marginBottom: 6 }}>Enable biometrics?</Text>
          <Text style={{ fontSize: 13, color: colors.muted, textAlign: 'center', lineHeight: 20 }}>
            Use Face ID, Touch ID, or fingerprint to keep the app locked when you're not using it — even if someone else picks up your phone.
          </Text>
        </View>
        <View style={{ backgroundColor: colors.cardAlt, borderRadius: 14, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: colors.border }}>
          {[['🔒', 'Your biometric never leaves this device'], ['🔁', 'Re-locks automatically after the app is backgrounded'], ['🛡', 'You can turn this off anytime in Profile']].map(([icon, text]) => (
            <View key={text} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 }}>
              <Text style={{ fontSize: 18 }}>{icon}</Text>
              <Text style={{ fontSize: 13, color: colors.ink, flex: 1 }}>{text}</Text>
            </View>
          ))}
        </View>
        <Btn full onPress={handleEnable}>Enable Biometric Lock</Btn>
        <View style={{ marginTop: 10, alignItems: 'center' }}>
          <Text onPress={handleSkip} style={{ color: colors.muted, fontSize: 13 }}>Skip for now</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
