import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { Btn, Input, ChipRow } from '../../components/UI';
import { API_BASE_URL } from '../../config';

const ROLES = ['Senior / Patient 👴', 'Family Member 🏠', 'Caregiver 🤝', 'Pregnant Mom 🤰'];
const ROLE_MAP = { 'Senior / Patient 👴': 'senior', 'Family Member 🏠': 'family', 'Caregiver 🤝': 'caregiver', 'Pregnant Mom 🤰': 'family' };

export default function RegisterScreen({ navigation }) {
  const { colors } = useTheme();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('Family Member 🏠');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleRegister() {
    if (!name || !email || !password) { setError('Please fill all required fields.'); return; }
    setLoading(true); setError('');
    try {
      const regRes = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const tokens = await regRes.json();
      if (!regRes.ok) { setError(tokens.error || 'Registration failed.'); return; }

      const roleValue = ROLE_MAP[role] || 'family';
      const familyPath = inviteCode.trim() ? '/api/families/join' : '/api/families';
      const familyBody = inviteCode.trim() ? { inviteCode: inviteCode.trim(), role: roleValue } : { role: roleValue, seniorName: roleValue === 'senior' ? name : undefined };
      await fetch(`${API_BASE_URL}${familyPath}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens.accessToken}` },
        body: JSON.stringify(familyBody),
      });

      navigation.replace('BiometricSetup', { tokens, role: roleValue });
    } catch (e) {
      setError('Could not reach the server. Check your connection and API_BASE_URL.');
    } finally { setLoading(false); }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}>
        <View style={{ backgroundColor: colors.card, borderRadius: 24, padding: 28, borderWidth: 1, borderColor: colors.border, borderTopWidth: 4, borderTopColor: colors.amber }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginBottom: 16 }}>
            <Text style={{ color: colors.muted, fontSize: 13 }}>← Back</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 22, fontWeight: '800', color: colors.ink, textAlign: 'center' }}>Create account</Text>
          <Text style={{ fontSize: 13, color: colors.muted, textAlign: 'center', marginTop: 4, marginBottom: 20 }}>Join Caretaker24 to start caring</Text>

          {error ? <Text style={{ color: colors.rose, fontSize: 13, marginBottom: 12 }}>{error}</Text> : null}
          <Input label="Full name" value={name} onChangeText={setName} placeholder="Your full name" />
          <Input label="Email address" value={email} onChangeText={setEmail} placeholder="email@example.com" keyboardType="email-address" />
          <Input label="Password" value={password} onChangeText={setPassword} placeholder="••••••••" secureTextEntry />

          <Text style={{ fontSize: 12, fontWeight: '700', color: colors.amber, marginTop: 4, marginBottom: 8 }}>I AM REGISTERING AS</Text>
          <ChipRow options={ROLES} selected={role} onSelect={setRole} />

          <View style={{ marginTop: 14 }}>
            <Input label="Household invite code (optional)" value={inviteCode} onChangeText={setInviteCode} placeholder="Leave blank to start a new household" />
          </View>

          <View style={{ marginTop: 4 }}>
            <Btn full loading={loading} onPress={handleRegister}>Create Account</Btn>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
