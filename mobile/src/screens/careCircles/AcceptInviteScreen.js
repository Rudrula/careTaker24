import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { Card, Btn } from '../../components/UI';
import { getInvitationByToken, acceptInvitation, rejectInvitation } from '../../services/invitationService';

export default function AcceptInviteScreen({ route, navigation }) {
  const { colors } = useTheme();
  const { token } = route.params || {};
  const [invite, setInvite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [responding, setResponding] = useState(false);

  useEffect(() => {
    if (!token) { setError('This invite link is missing its code.'); setLoading(false); return; }
    (async () => {
      try {
        setInvite(await getInvitationByToken(token));
      } catch (e) {
        setError(e.message || "This invite link isn't valid or has expired.");
      } finally { setLoading(false); }
    })();
  }, [token]);

  async function handleAccept() {
    setResponding(true);
    try {
      await acceptInvitation(token);
      Alert.alert('Joined!', `You're now part of "${invite?.careCircleId?.name || 'the Care Circle'}".`, [
        { text: 'OK', onPress: () => navigation.navigate('CareCircles') },
      ]);
    } catch (e) {
      Alert.alert('Couldn\'t accept', e.message || 'Please try again.');
    } finally { setResponding(false); }
  }

  async function handleReject() {
    setResponding(true);
    try {
      await rejectInvitation(token);
      navigation.navigate('AccountHub');
    } catch (e) {
      Alert.alert('Couldn\'t decline', e.message || 'Please try again.');
    } finally { setResponding(false); }
  }

  if (loading) {
    return <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={colors.primary} /></SafeAreaView>;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, padding: 16, justifyContent: 'center' }}>
      {error ? (
        <Card>
          <Text style={{ fontSize: 15, fontWeight: '700', color: colors.rose, marginBottom: 8 }}>Couldn't open this invite</Text>
          <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 16 }}>{error}</Text>
          <Btn full variant="outline" onPress={() => navigation.navigate('AccountHub')}>Go to Account</Btn>
        </Card>
      ) : (
        <Card>
          <Text style={{ fontSize: 36, textAlign: 'center', marginBottom: 10 }}>{invite?.careCircleId?.icon || '👨‍👩‍👧'}</Text>
          <Text style={{ fontSize: 18, fontWeight: '800', color: colors.ink, textAlign: 'center' }}>
            {invite?.invitedBy?.name || 'Someone'} invited you to
          </Text>
          <Text style={{ fontSize: 20, fontWeight: '800', color: colors.primary, textAlign: 'center', marginBottom: 6 }}>
            "{invite?.careCircleId?.name || 'a Care Circle'}"
          </Text>
          <Text style={{ fontSize: 13, color: colors.muted, textAlign: 'center', marginBottom: 20 }}>
            You'd join as {invite?.proposedRole || 'a family member'}
          </Text>
          <Btn full loading={responding} onPress={handleAccept} style={{ marginBottom: 10 }}>Accept</Btn>
          <Btn full variant="outline" onPress={handleReject} disabled={responding}>Decline</Btn>
        </Card>
      )}
    </SafeAreaView>
  );
}
