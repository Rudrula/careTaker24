import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../../context/ThemeContext';
import { Card, Input, Btn, StatusPill, ChipRow, Sect } from '../../components/UI';
import {
  INVITE_METHODS, createInvitation, listInvitationsForCircle, resendInvitation, cancelInvitation,
} from '../../services/invitationService';

const ROLES = ['senior', 'family', 'caregiver', 'viewer'];

export default function InviteToCircleScreen({ route }) {
  const { colors } = useTheme();
  const { circleId, circleName } = route.params || {};
  const [method, setMethod] = useState('link');
  const [targetEmail, setTargetEmail] = useState('');
  const [targetPhone, setTargetPhone] = useState('');
  const [proposedRole, setProposedRole] = useState('family');
  const [sending, setSending] = useState(false);
  const [lastInvite, setLastInvite] = useState(null); // { invitation, delivery } from the most recent create/resend

  const [pending, setPending] = useState([]);
  const [loadingPending, setLoadingPending] = useState(true);

  const loadPending = useCallback(async () => {
    try { setPending(await listInvitationsForCircle(circleId, 'pending')); }
    catch (e) { setPending([]); }
    finally { setLoadingPending(false); }
  }, [circleId]);

  useFocusEffect(useCallback(() => { loadPending(); }, [loadPending]));

  async function handleSend() {
    if (method === 'email' && !targetEmail.trim()) { Alert.alert('Email required', 'Enter an email address for this method.'); return; }
    if (['phone', 'sms', 'whatsapp'].includes(method) && !targetPhone.trim()) { Alert.alert('Phone required', 'Enter a mobile number for this method.'); return; }

    setSending(true);
    try {
      const result = await createInvitation({
        careCircleId: circleId, method,
        targetEmail: targetEmail.trim() || undefined,
        targetPhone: targetPhone.trim() || undefined,
        proposedRole,
      });
      setLastInvite(result);
      if (result.delivery?.sent === false) {
        Alert.alert('Invitation created', `Couldn't auto-deliver it (${result.delivery.reason || 'delivery not configured'}) — share the link below manually instead.`);
      }
      setTargetEmail(''); setTargetPhone('');
      loadPending();
    } catch (e) {
      Alert.alert('Couldn\'t send invitation', e.message || 'Please try again.');
    } finally { setSending(false); }
  }

  async function copyLink(url) {
    await Clipboard.setStringAsync(url);
    Alert.alert('Copied', 'Invite link copied to clipboard.');
  }

  async function shareLink(url) {
    try { await Share.share({ message: `Join "${circleName}" on Caretaker24: ${url}` }); }
    catch (e) { /* user cancelled the share sheet — not an error */ }
  }

  async function handleResend(inv) {
    try {
      const result = await resendInvitation(inv.id);
      setLastInvite(result);
      loadPending();
    } catch (e) { Alert.alert('Couldn\'t resend', e.message); }
  }

  function confirmCancel(inv) {
    Alert.alert('Cancel this invitation?', 'The invite link will stop working.', [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Cancel invitation', style: 'destructive', onPress: () => handleCancel(inv) },
    ]);
  }
  async function handleCancel(inv) {
    try { await cancelInvitation(inv.id); loadPending(); }
    catch (e) { Alert.alert('Couldn\'t cancel', e.message); }
  }

  const showEmailField = method === 'email';
  const showPhoneField = ['phone', 'sms', 'whatsapp'].includes(method);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView style={{ flex: 1, padding: 16 }} contentContainerStyle={{ paddingBottom: 40 }}>
        <Text style={{ fontWeight: '800', fontSize: 20, color: colors.ink, marginBottom: 4 }}>Invite to {circleName}</Text>
        <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 16 }}>Choose how you'd like to send the invite</Text>

        <Card>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
            {INVITE_METHODS.map(m => (
              <TouchableOpacity key={m.value} onPress={() => { setMethod(m.value); setLastInvite(null); }}
                style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, borderColor: method === m.value ? colors.primary : colors.border, backgroundColor: method === m.value ? colors.primarySoft : colors.cardAlt, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Text style={{ fontSize: 14 }}>{m.icon}</Text>
                <Text style={{ fontSize: 12, fontWeight: '600', color: method === m.value ? colors.primary : colors.muted }}>{m.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {showEmailField && <Input label="Email address" value={targetEmail} onChangeText={setTargetEmail} placeholder="name@example.com" keyboardType="email-address" />}
          {showPhoneField && <Input label="Mobile number" value={targetPhone} onChangeText={setTargetPhone} placeholder="+1 555 123 4567" keyboardType="phone-pad" />}

          <Text style={{ fontSize: 12, fontWeight: '600', color: colors.muted, marginBottom: 6, marginTop: showEmailField || showPhoneField ? 0 : 4 }}>Join as</Text>
          <ChipRow options={ROLES} selected={proposedRole} onSelect={setProposedRole} />

          <View style={{ height: 14 }} />
          <Btn full loading={sending} onPress={handleSend}>
            {method === 'qr' || method === 'link' ? 'Generate invite' : 'Send invitation'}
          </Btn>
        </Card>

        {lastInvite?.delivery?.inviteUrl && (
          <Card>
            {(method === 'qr') && (
              <View style={{ alignItems: 'center', marginBottom: 14 }}>
                <View style={{ backgroundColor: '#fff', padding: 16, borderRadius: 14 }}>
                  <QRCode value={`caretaker24://invite/${lastInvite.invitation.token}`} size={180} />
                </View>
                <Text style={{ fontSize: 11, color: colors.muted, marginTop: 8, textAlign: 'center' }}>Scan this with the Caretaker24 app to join instantly</Text>
              </View>
            )}
            <Text style={{ fontSize: 11, fontWeight: '700', color: colors.muted, marginBottom: 6 }}>INVITE LINK</Text>
            <View style={{ backgroundColor: colors.cardAlt, borderRadius: 10, padding: 12, marginBottom: 10 }}>
              <Text style={{ fontSize: 12, color: colors.ink }} numberOfLines={1}>{lastInvite.delivery.inviteUrl}</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Btn size="sm" variant="outline" onPress={() => copyLink(lastInvite.delivery.inviteUrl)} style={{ flex: 1 }}>Copy</Btn>
              <Btn size="sm" onPress={() => shareLink(lastInvite.delivery.inviteUrl)} style={{ flex: 1 }}>Share</Btn>
            </View>
          </Card>
        )}

        <Sect title="Pending invitations">
          {loadingPending ? <ActivityIndicator color={colors.primary} /> : null}
          {!loadingPending && pending.length === 0 && <Text style={{ color: colors.muted, fontSize: 13 }}>No pending invitations.</Text>}
          {pending.map(inv => (
            <Card key={inv.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.ink }}>{inv.targetEmail || inv.targetPhone || 'Shareable link'}</Text>
                <Text style={{ fontSize: 11, color: colors.muted }}>via {inv.method} · as {inv.proposedRole} {inv.resendCount > 0 ? `· resent ${inv.resendCount}×` : ''}</Text>
              </View>
              <StatusPill label="Pending" bg="rgba(245,158,11,.12)" fg={colors.amber} />
              <TouchableOpacity onPress={() => handleResend(inv)} style={{ marginLeft: 10 }}>
                <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600' }}>Resend</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => confirmCancel(inv)} style={{ marginLeft: 10 }}>
                <Text style={{ color: colors.rose, fontSize: 12, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
            </Card>
          ))}
        </Sect>
      </ScrollView>
    </SafeAreaView>
  );
}
