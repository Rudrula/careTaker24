import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Crown, Shield, Trash2, Star, Ban } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { Card, StatusPill, ChipRow, Sect } from '../../components/UI';
import { listMembers, updateMember, removeMember, listBlockedUsers, unblockUser, blockUser } from '../../services/careCircleService';

const ROLES = ['senior', 'family', 'caregiver', 'viewer'];

export default function CareCircleMembersScreen({ route }) {
  const { colors } = useTheme();
  const { circleId } = route.params || {};
  const [members, setMembers] = useState([]);
  const [blocked, setBlocked] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  const load = useCallback(async () => {
    try {
      const [m, b] = await Promise.all([listMembers(circleId), listBlockedUsers(circleId).catch(() => [])]);
      setMembers(m || []);
      setBlocked(b || []);
    } catch (e) {
      Alert.alert('Error', 'Could not load members.');
    } finally { setLoading(false); }
  }, [circleId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function handleRoleChange(member, role) {
    try {
      await updateMember(circleId, member.userId, { role });
      load();
    } catch (e) { Alert.alert('Couldn\'t update role', e.message); }
  }

  async function handleTogglePrimary(member) {
    try {
      await updateMember(circleId, member.userId, { isPrimaryContact: !member.isPrimaryContact });
      load();
    } catch (e) { Alert.alert('Couldn\'t update', e.message); }
  }

  async function handleTogglePermission(member, key) {
    try {
      await updateMember(circleId, member.userId, { permissions: { [key]: !member.permissions[key] } });
      load();
    } catch (e) { Alert.alert('Couldn\'t update permission', e.message); }
  }

  function confirmRemove(member) {
    Alert.alert('Remove member?', `${member.name} will lose access to this Care Circle.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => handleRemove(member) },
    ]);
  }
  async function handleRemove(member) {
    try {
      await removeMember(circleId, member.userId);
      load();
    } catch (e) { Alert.alert('Couldn\'t remove', e.message); }
  }

  function confirmBlock(member) {
    Alert.alert(
      'Block this person?',
      `${member.name} will be removed and won't be able to rejoin this Care Circle until you unblock them.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Block', style: 'destructive', onPress: () => handleBlock(member) },
      ],
    );
  }
  async function handleBlock(member) {
    try {
      await blockUser(circleId, { userId: member.userId });
      load();
    } catch (e) { Alert.alert('Couldn\'t block', e.message); }
  }

  async function handleUnblock(block) {
    try {
      await unblockUser(circleId, block.id);
      load();
    } catch (e) { Alert.alert('Couldn\'t unblock', e.message); }
  }

  if (loading) return <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={colors.primary} /></SafeAreaView>;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView style={{ flex: 1, padding: 16 }} contentContainerStyle={{ paddingBottom: 40 }}>
        <Text style={{ fontWeight: '800', fontSize: 20, color: colors.ink, marginBottom: 4 }}>Members</Text>
        <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 16 }}>Tap a member to manage their role, permissions, and missed-dose alerts</Text>

        {members.map(m => {
          const expanded = expandedId === m.userId;
          return (
            <Card key={m.userId}>
              <TouchableOpacity onPress={() => setExpandedId(expanded ? null : m.userId)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 38, height: 38, borderRadius: 99, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 16 }}>{m.isOwner ? '👑' : '👤'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '700', fontSize: 14, color: colors.ink }}>{m.name} {m.isPrimaryContact && <Star size={12} color={colors.amber} />}</Text>
                  <Text style={{ fontSize: 11, color: colors.muted }}>{m.email || m.phone}</Text>
                </View>
                <StatusPill label={m.isOwner ? 'Owner' : m.role} bg={colors.greyLt} fg={m.isOwner ? colors.amber : colors.muted} />
              </TouchableOpacity>

              {expanded && (
                <View style={{ marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.border }}>
                  {!m.isOwner && (
                    <>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: colors.muted, marginBottom: 6 }}>ROLE</Text>
                      <ChipRow options={ROLES} selected={m.role} onSelect={r => handleRoleChange(m, r)} />
                    </>
                  )}

                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.ink }}>⭐ Primary contact</Text>
                      <Text style={{ fontSize: 11, color: colors.muted }}>Gets notified if a medicine dose is missed</Text>
                    </View>
                    <Switch value={m.isPrimaryContact} onValueChange={() => handleTogglePrimary(m)} trackColor={{ true: colors.primary }} />
                  </View>

                  {!m.isOwner && (
                    <>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: colors.muted, marginTop: 14, marginBottom: 6 }}>PERMISSIONS</Text>
                      {[
                        ['canEditMedicines', 'Edit medicines'], ['canManageBilling', 'Manage bills'],
                        ['canInviteMembers', 'Invite people'], ['canManageMembers', 'Manage members'],
                        ['canViewReports', 'View reports'],
                      ].map(([key, label]) => (
                        <View key={key} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 }}>
                          <Text style={{ fontSize: 13, color: colors.ink }}>{label}</Text>
                          <Switch value={!!m.permissions?.[key]} onValueChange={() => handleTogglePermission(m, key)} trackColor={{ true: colors.primary }} />
                        </View>
                      ))}
                      <View style={{ flexDirection: 'row', gap: 20, marginTop: 14 }}>
                        <TouchableOpacity onPress={() => confirmRemove(m)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Trash2 size={14} color={colors.rose} />
                          <Text style={{ color: colors.rose, fontSize: 13, fontWeight: '600' }}>Remove from circle</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => confirmBlock(m)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Ban size={14} color={colors.rose} />
                          <Text style={{ color: colors.rose, fontSize: 13, fontWeight: '600' }}>Block</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  )}
                </View>
              )}
            </Card>
          );
        })}

        {blocked.length > 0 && (
          <Sect title="Blocked users">
            {blocked.map(b => (
              <Card key={b.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Shield size={16} color={colors.rose} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: colors.ink }}>{b.blockedUserId?.name || b.blockedEmail || b.blockedPhone}</Text>
                  {b.reason ? <Text style={{ fontSize: 11, color: colors.muted }}>{b.reason}</Text> : null}
                </View>
                <TouchableOpacity onPress={() => handleUnblock(b)}>
                  <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600' }}>Unblock</Text>
                </TouchableOpacity>
              </Card>
            ))}
          </Sect>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
