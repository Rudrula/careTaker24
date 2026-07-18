import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Crown, Eye, EyeOff } from 'lucide-react-native';
import * as AuthSession from 'expo-auth-session';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { Btn, Input } from '../../components/UI';
import { getGoogleClientId, discovery, exchangeGoogleToken, isAppleAuthAvailable, signInWithApple } from '../../services/oauthService';
import { API_BASE_URL } from '../../config';

export default function LoginScreen({ navigation }) {
  const { colors } = useTheme();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const redirectUri = AuthSession.makeRedirectUri({ scheme: 'caretaker24' });
  const [request, response, promptGoogleAuth] = AuthSession.useAuthRequest(
    { clientId: getGoogleClientId(), scopes: ['openid', 'profile', 'email'], redirectUri, responseType: 'id_token', extraParams: { nonce: String(Date.now()) } },
    discovery
  );

  React.useEffect(() => {
    if (response?.type === 'success' && response.params.id_token) {
      handleGoogleToken(response.params.id_token);
    } else if (response?.type === 'error') {
      setError('Google sign-in was cancelled or failed.');
    }
  }, [response]);

  async function handleGoogleToken(idToken) {
    setLoading(true); setError('');
    try {
      const tokens = await exchangeGoogleToken(idToken);
      await signIn('family', tokens);
    } catch (e) {
      setError(e.message || 'Google sign-in failed.');
    } finally { setLoading(false); }
  }

  async function handleAppleSignIn() {
    setLoading(true); setError('');
    try {
      const available = await isAppleAuthAvailable();
      if (!available) { setError('Sign in with Apple is only available on iOS devices.'); return; }
      const tokens = await signInWithApple();
      await signIn('family', tokens);
    } catch (e) {
      if (e.code !== 'ERR_REQUEST_CANCELED') setError('Apple sign-in failed.');
    } finally { setLoading(false); }
  }

  async function handleLogin() {
    if (!email || !password) { setError('Please enter your email and password.'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || 'Invalid email or password.'); return; }
      await signIn('family', json);
    } catch (e) {
      setError('Could not reach the server. Check your connection and API_BASE_URL.');
    } finally { setLoading(false); }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}>
        <View style={{ backgroundColor: colors.card, borderRadius: 24, padding: 28, borderWidth: 1, borderColor: colors.border, borderTopWidth: 4, borderTopColor: colors.amber }}>
          <View style={{ alignItems: 'center', marginBottom: 24 }}>
            <View style={{ width: 80, height: 80, borderRadius: 20, backgroundColor: colors.primarySoft, borderWidth: 2, borderColor: colors.amber, alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
              <Crown color={colors.amber} size={38} />
            </View>
            <Text style={{ fontWeight: '900', fontSize: 26, color: colors.ink }}>Caretaker24</Text>
            <Text style={{ color: colors.muted, fontSize: 15, marginTop: 4 }}>Care across any distance</Text>
          </View>

          <TouchableOpacity onPress={() => promptGoogleAuth()} disabled={!request || loading} style={{ borderWidth: 1.5, borderColor: colors.border, borderRadius: 14, padding: 16, minHeight: 54, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <Text style={{ fontWeight: '600', color: colors.ink, fontSize: 16 }}>Continue with Google</Text>
          </TouchableOpacity>
          {Platform.OS === 'ios' && (
            <TouchableOpacity onPress={handleAppleSignIn} disabled={loading} style={{ backgroundColor: '#000', borderRadius: 14, padding: 16, minHeight: 54, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <Text style={{ fontWeight: '600', color: '#fff', fontSize: 16 }}> Continue with Apple</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => navigation.navigate('Otp')} style={{ borderWidth: 1.5, borderColor: colors.border, borderRadius: 14, padding: 16, minHeight: 54, marginBottom: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <Text style={{ fontWeight: '600', color: colors.ink, fontSize: 16 }}>📱 Get a code by text message</Text>
          </TouchableOpacity>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
            <Text style={{ fontSize: 13, color: colors.muted, fontWeight: '600' }}>or sign in with email</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
          </View>

          {error ? <Text style={{ color: colors.rose, fontSize: 14, marginBottom: 12 }}>{error}</Text> : null}
          <Input label="Email address" value={email} onChangeText={setEmail} placeholder="email@example.com" keyboardType="email-address" />
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.amber, marginBottom: 6 }}>PASSWORD</Text>
            <View style={{ position: 'relative' }}>
              <Input value={password} onChangeText={setPassword} secureTextEntry={!showPw} placeholder="••••••••" />
              <TouchableOpacity onPress={() => setShowPw(!showPw)} style={{ position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center' }}>
                {showPw ? <EyeOff size={20} color={colors.muted} /> : <Eye size={20} color={colors.muted} />}
              </TouchableOpacity>
            </View>
          </View>
          <Btn full loading={loading} onPress={handleLogin}>Sign In</Btn>

          <TouchableOpacity onPress={() => navigation.navigate('Register')} style={{ marginTop: 16, alignItems: 'center', minHeight: 44, justifyContent: 'center' }}>
            <Text style={{ color: colors.muted, fontSize: 14 }}>No account? <Text style={{ color: colors.amber, fontWeight: '700' }}>Register</Text></Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
