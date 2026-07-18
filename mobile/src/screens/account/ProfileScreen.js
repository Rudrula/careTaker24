import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Shield, LogOut, Smartphone, Fingerprint } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { apiJson } from '../../services/apiClient';
import { Card, Input, ChipRow, Btn } from '../../components/UI';

const BLOOD_TYPES = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];

export default function ProfileScreen({ navigation }) {
  const { colors } = useTheme();
  const { data, upd } = useData();
  const { signOut, signOutAllDevices, biometricEnabled, biometricAvailable, enableBiometric, disableBiometric } = useAuth();
  const [bioToggling, setBioToggling] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: data.currentUser?.name || '',
    email: data.currentUser?.email || '',
    country: data.currentUser?.country || '',
    bloodType: data.currentUser?.bloodType || 'O+',
    allergies: data.currentUser?.allergies || '',
    conditions: data.currentUser?.conditions || '',
  });

  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [signingOutAll, setSigningOutAll] = useState(false);

  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const list = await apiJson('/api/auth/sessions');
      setSessions(list || []);
    } catch (e) {
      setSessions([]); // offline or backend unreachable — section just shows empty
    } finally { setSessionsLoading(false); }
  }, []);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  function describeDevice(deviceInfo) {
    if (!deviceInfo) return 'Unknown device';
    if (/iphone|ios/i.test(deviceInfo)) return '📱 iPhone';
    if (/android/i.test(deviceInfo)) return '📱 Android device';
    return '💻 ' + deviceInfo.slice(0, 40);
  }

  function confirmSignOutAll() {
    Alert.alert(
      'Sign out everywhere?',
      'This immediately signs out every device — including this one. You\'ll need to sign in again on all of them.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out everywhere', style: 'destructive',
          onPress: async () => { setSigningOutAll(true); await signOutAllDevices(); },
        },
      ],
    );
  }

  function save() {
    upd(p => ({ ...p, currentUser: { ...p.currentUser, ...form } }));
    setEditing(false);
  }

  async function handleToggleBiometric(next) {
    setBioToggling(true);
    try {
      if (next) {
        const ok = await enableBiometric();
        if (!ok) {
          Alert.alert(
            'Not available',
            "This device doesn't have Face ID, Touch ID, or fingerprint set up yet. Set one up in your phone's Settings app first, then try again here.",
          );
        }
      } else {
        await disableBiometric();
      }
    } finally { setBioToggling(false); }
  }

  const fields = [
    ['Full name', 'name'], ['Email address', 'email'], ['Country', 'country'],
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView style={{ flex: 1, padding: 16 }} contentContainerStyle={{ paddingBottom: 40 }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginBottom: 12 }}>
          <Text style={{ color: colors.muted, fontSize: 13 }}>← Account</Text>
        </TouchableOpacity>

        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ fontWeight: '700', fontSize: 15, color: colors.ink }}>Personal details</Text>
            <TouchableOpacity onPress={() => editing ? save() : setEditing(true)} style={{ backgroundColor: editing ? colors.primary : colors.primarySoft, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6 }}>
              <Text style={{ color: editing ? '#fff' : colors.primary, fontWeight: '700', fontSize: 13 }}>{editing ? '💾 Save' : '✏️ Edit'}</Text>
            </TouchableOpacity>
          </View>

          {fields.map(([label, key]) => (
            <View key={key} style={{ marginBottom: 10 }}>
              <Text style={{ fontSize: 11, fontWeight: '600', color: colors.muted, marginBottom: 3 }}>{label.toUpperCase()}</Text>
              {editing ? (
                <Input value={form[key]} onChangeText={t => setForm(f => ({ ...f, [key]: t }))} />
              ) : (
                <Text style={{ fontSize: 14, color: colors.ink, backgroundColor: colors.cardAlt, borderRadius: 10, padding: 10 }}>{form[key] || '—'}</Text>
              )}
            </View>
          ))}

          <Text style={{ fontWeight: '700', fontSize: 14, color: colors.ink, marginTop: 12, marginBottom: 10 }}>Health profile</Text>
          <Text style={{ fontSize: 11, fontWeight: '600', color: colors.muted, marginBottom: 6 }}>BLOOD TYPE</Text>
          {editing ? (
            <ChipRow options={BLOOD_TYPES} selected={form.bloodType} onSelect={bt => setForm(f => ({ ...f, bloodType: bt }))} />
          ) : (
            <Text style={{ fontSize: 14, color: colors.ink, backgroundColor: colors.cardAlt, borderRadius: 10, padding: 10, marginBottom: 10 }}>{form.bloodType}</Text>
          )}

          <View style={{ marginTop: 10 }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: colors.muted, marginBottom: 3 }}>ALLERGIES</Text>
            {editing ? <Input value={form.allergies} onChangeText={t => setForm(f => ({ ...f, allergies: t }))} placeholder="e.g. Penicillin, Peanuts" /> :
              <Text style={{ fontSize: 14, color: colors.ink, backgroundColor: colors.cardAlt, borderRadius: 10, padding: 10 }}>{form.allergies || 'None listed'}</Text>}
          </View>
          <View style={{ marginTop: 10 }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: colors.muted, marginBottom: 3 }}>CONDITIONS</Text>
            {editing ? <Input value={form.conditions} onChangeText={t => setForm(f => ({ ...f, conditions: t }))} placeholder="e.g. Diabetes, Hypertension" /> :
              <Text style={{ fontSize: 14, color: colors.ink, backgroundColor: colors.cardAlt, borderRadius: 10, padding: 10 }}>{form.conditions || 'None listed'}</Text>}
          </View>
        </Card>

        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
              <View style={{ width: 34, height: 34, borderRadius: 99, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                <Fingerprint size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700', fontSize: 15, color: colors.ink }}>Biometric lock</Text>
                <Text style={{ fontSize: 12, color: colors.muted }}>
                  {biometricEnabled ? 'Re-locks after 30s in the background' : 'Face ID, Touch ID, or fingerprint to open the app'}
                </Text>
              </View>
            </View>
            {bioToggling ? <ActivityIndicator size="small" color={colors.primary} /> : (
              <Switch value={biometricEnabled} onValueChange={handleToggleBiometric} trackColor={{ true: colors.primary }} />
            )}
          </View>
          {biometricEnabled && !biometricAvailable && (
            <Text style={{ fontSize: 12, color: colors.rose, marginTop: 10 }}>
              ⚠️ This device currently has no biometrics enrolled — the app won't be able to re-lock properly until you either set one up in your phone's Settings or turn this off.
            </Text>
          )}
        </Card>

        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Shield size={16} color={colors.primary} />
            <Text style={{ fontWeight: '700', fontSize: 15, color: colors.ink, flex: 1 }}>Active sessions</Text>
            {sessionsLoading && <ActivityIndicator size="small" color={colors.primary} />}
          </View>
          {!sessionsLoading && sessions.length === 0 && (
            <Text style={{ fontSize: 13, color: colors.muted }}>No other active sessions found.</Text>
          )}
          {sessions.map(s => (
            <View key={s.family} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                <Smartphone size={16} color={colors.muted} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, color: colors.ink }}>{describeDevice(s.deviceInfo)}</Text>
                  <Text style={{ fontSize: 11, color: colors.muted }}>Signed in {new Date(s.createdAt).toLocaleDateString()}</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => {
                  Alert.alert('Sign out this device?', 'That device will need to sign in again.', [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Sign out', style: 'destructive',
                      onPress: async () => { await apiJson(`/api/auth/sessions/${s.family}`, { method: 'DELETE' }); loadSessions(); },
                    },
                  ]);
                }}
              >
                <Text style={{ color: colors.rose, fontSize: 12, fontWeight: '600' }}>Sign out</Text>
              </TouchableOpacity>
            </View>
          ))}

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
            <Btn variant="outline" style={{ flex: 1 }} onPress={signOut}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <LogOut size={15} color={colors.primary} />
                <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 13 }}>Sign out</Text>
              </View>
            </Btn>
            <TouchableOpacity
              onPress={confirmSignOutAll}
              disabled={signingOutAll}
              style={{ flex: 1, borderRadius: 12, borderWidth: 1.5, borderColor: 'rgba(255,77,106,.4)', alignItems: 'center', justifyContent: 'center', paddingVertical: 13 }}
            >
              {signingOutAll ? <ActivityIndicator size="small" color={colors.rose} /> : <Text style={{ color: colors.rose, fontWeight: '700', fontSize: 13 }}>Sign out everywhere</Text>}
            </TouchableOpacity>
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
