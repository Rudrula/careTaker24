import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { Btn, Input } from '../../components/UI';
import { API_BASE_URL } from '../../config';

export default function OtpScreen({ navigation }) {
  const { colors } = useTheme();
  const { signIn } = useAuth();
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [timer, setTimer] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => () => clearInterval(timerRef.current), []);

  function startTimer() {
    setTimer(30);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setTimer(t => { if (t <= 1) { clearInterval(timerRef.current); return 0; } return t - 1; }), 1000);
  }

  async function sendOtp() {
    setLoading(true); setError('');
    try {
      // POST /api/auth/otp/send { phone } — backend uses Twilio/MSG91/etc.
      await fetch(`${API_BASE_URL}/api/auth/otp/send`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone }) }).catch(() => {});
      setSent(true); startTimer();
    } finally { setLoading(false); }
  }

  async function verifyOtp() {
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/otp/verify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, otp }) });
      const tokens = await res.json();
      if (res.ok) { navigation.replace('BiometricSetup', { tokens, role: 'family' }); }
      else { setError(tokens.error || 'Incorrect OTP. Please try again.'); }
    } catch (e) {
      setError('Could not reach the server. Check your connection and API_BASE_URL.');
    } finally { setLoading(false); }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', padding: 24 }}>
      <View style={{ backgroundColor: colors.card, borderRadius: 24, padding: 28, borderWidth: 1, borderColor: colors.border, borderTopWidth: 4, borderTopColor: colors.amber }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginBottom: 16 }}>
          <Text style={{ color: colors.muted, fontSize: 13 }}>← Back</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 48, textAlign: 'center', marginBottom: 10 }}>📱</Text>
        <Text style={{ fontSize: 20, fontWeight: '800', color: colors.ink, textAlign: 'center' }}>Mobile OTP</Text>
        <Text style={{ fontSize: 13, color: colors.muted, textAlign: 'center', marginTop: 4, marginBottom: 20 }}>
          {sent ? `We sent a code to ${phone}` : "Enter your mobile number and we'll send a 6-digit code."}
        </Text>

        {error ? <Text style={{ color: colors.rose, fontSize: 13, marginBottom: 12, textAlign: 'center' }}>{error}</Text> : null}

        {!sent ? (
          <>
            <Input label="Mobile number" value={phone} onChangeText={setPhone} placeholder="+91 98765 43210" keyboardType="phone-pad" />
            <Btn full loading={loading} disabled={phone.length < 6} onPress={sendOtp}>Send OTP</Btn>
          </>
        ) : (
          <>
            <Input label="6-digit OTP" value={otp} onChangeText={t => setOtp(t.replace(/\D/g, '').slice(0, 6))} placeholder="123456" keyboardType="number-pad" />
            <Btn full loading={loading} disabled={otp.length < 6} onPress={verifyOtp}>Verify OTP</Btn>
            <View style={{ alignItems: 'center', marginTop: 12 }}>
              {timer > 0 ? (
                <Text style={{ fontSize: 13, color: colors.muted }}>Resend in {timer}s</Text>
              ) : (
                <TouchableOpacity onPress={() => { setOtp(''); sendOtp(); }}>
                  <Text style={{ color: colors.amber, fontWeight: '700', fontSize: 13 }}>Resend OTP</Text>
                </TouchableOpacity>
              )}
            </View>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
