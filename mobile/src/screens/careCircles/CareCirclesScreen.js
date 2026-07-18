import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Plus, ChevronRight, Check } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { Card, StatusPill, Btn } from '../../components/UI';
import { listCircles, setActiveCircle } from '../../services/careCircleService';
import { listMyInvitations, acceptInvitation, rejectInvitation } from '../../services/invitationService';

export default function CareCirclesScreen({ navigation }) {
  const { colors } = useTheme();
  const [circles, setCircles] = useState([]);
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(null);
  const [respondingId, setRespondingId] = useState(null);

  const load = useCallback(async () => {
    try {
      const [c, i] = await Promise.all([listCircles(), listMyInvitations()]);
      setCircles(c || []);
      setInvites(i || []);
    } catch (e) {
      // Offline or backend unreachable — screen just shows what it last had.
    } finally { setLoading(false); }
  }, []);

  // Refresh every time this screen comes back into focus (e.g. returning
  // from Create/Settings after a change) rather than only once on mount.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function handleSwitch(circle) {
    if (circle.isActive) return;
    setSwitching(circle.id);
    try {
      await setActiveCircle(circle.id);
      await load();
    } catch (e) {
      Alert.alert('Couldn\'t switch', e.message || 'Please try again.');
    } finally { setSwitching(null); }
  }

  async function handleAccept(invite) {
    setRespondingId(invite.id);
    try {
      await acceptInvitation(invite.token);
      await load();
      Alert.alert('Joined!', `You're now part of "${invite.careCircleId?.name || 'the Care Circle'}".`);
    } catch (e) {
      Alert.alert('Couldn\'t accept', e.message || 'Please try again.');
    } finally { setRespondingId(null); }
  }

  async function handleReject(invite) {
    setRespondingId(invite.id);
    try {
      await rejectInvitation(invite.token);
      await load();
    } catch (e) {
      Alert.alert('Couldn\'t reject', e.message || 'Please try again.');
    } finally { setRespondingId(null); }
  }

  const activeCircles = circles.filter(c => c.status === 'active');
  const archivedCircles = circles.filter(c => c.status === 'archived');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView style={{ flex: 1, padding: 16 }} contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginBottom: 12 }}>
          <Text style={{ color: colors.muted, fontSize: 13 }}>← Account</Text>
        </TouchableOpacity>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <Text style={{ fontWeight: '800', fontSize: 22, color: colors.ink }}>Care Circles</Text>
          <TouchableOpacity onPress={() => navigation.navigate('CreateCareCircle')} style={{ backgroundColor: colors.btnFill, borderRadius: 99, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
            <Plus size={20} color="#fff" />
          </TouchableOpacity>
        </View>
        <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 16 }}>Switch between the people and pets you care for</Text>

        {loading && !circles.length ? <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} /> : null}

        {invites.length > 0 && (
          <View style={{ marginBottom: 20 }}>
            <Text style={{ fontWeight: '700', fontSize: 14, color: colors.amber, marginBottom: 10 }}>📬 Invitations for you ({invites.length})</Text>
            {invites.map(inv => (
              <Card key={inv.id} style={{ borderWidth: 1.5, borderColor: colors.amber }}>
                <Text style={{ fontWeight: '700', fontSize: 14, color: colors.ink }}>{inv.careCircleId?.icon} {inv.careCircleId?.name || 'A Care Circle'}</Text>
                <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>Invited by {inv.invitedBy?.name || 'someone'} · as {inv.proposedRole}</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                  <Btn size="sm" onPress={() => handleAccept(inv)} loading={respondingId === inv.id} style={{ flex: 1 }}>Accept</Btn>
                  <Btn size="sm" variant="outline" onPress={() => handleReject(inv)} disabled={respondingId === inv.id} style={{ flex: 1 }}>Decline</Btn>
                </View>
              </Card>
            ))}
          </View>
        )}

        <Text style={{ fontWeight: '700', fontSize: 14, color: colors.amber, marginBottom: 10 }}>Your circles</Text>
        {activeCircles.map(c => (
          <TouchableOpacity key={c.id} onPress={() => handleSwitch(c)} activeOpacity={0.7}>
            <Card style={{ borderWidth: c.isActive ? 2 : 1, borderColor: c.isActive ? colors.primary : colors.border, flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: 28, marginRight: 12 }}>{c.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700', fontSize: 15, color: colors.ink }}>{c.name}</Text>
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 4, alignItems: 'center' }}>
                  <StatusPill label={c.isOwner ? 'Owner' : c.myRole} bg={colors.greyLt} fg={colors.muted} />
                  {c.isActive && <StatusPill label="Active" bg={colors.primarySoft} fg={colors.primary} />}
                </View>
              </View>
              {switching === c.id ? <ActivityIndicator size="small" color={colors.primary} /> : (
                c.isActive ? <Check size={20} color={colors.primary} /> : (
                  <TouchableOpacity onPress={() => navigation.navigate('CareCircleSettings', { circleId: c.id })} style={{ padding: 4 }}>
                    <ChevronRight size={20} color={colors.muted} />
                  </TouchableOpacity>
                )
              )}
            </Card>
          </TouchableOpacity>
        ))}
        {!loading && activeCircles.length === 0 && (
          <Text style={{ color: colors.muted, fontSize: 13, textAlign: 'center', marginVertical: 12 }}>No Care Circles yet — tap + to create one.</Text>
        )}

        {archivedCircles.length > 0 && (
          <>
            <Text style={{ fontWeight: '700', fontSize: 14, color: colors.muted, marginTop: 16, marginBottom: 10 }}>
              📦 Archived
            </Text>
            {archivedCircles.map(c => (
              <TouchableOpacity key={c.id} onPress={() => navigation.navigate('CareCircleSettings', { circleId: c.id })} activeOpacity={0.7}>
                <Card style={{ opacity: 0.6, flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ fontSize: 24, marginRight: 12 }}>{c.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '600', fontSize: 14, color: colors.ink }}>{c.name}</Text>
                    <Text style={{ fontSize: 11, color: colors.muted }}>Archived</Text>
                  </View>
                  <ChevronRight size={18} color={colors.muted} />
                </Card>
              </TouchableOpacity>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
