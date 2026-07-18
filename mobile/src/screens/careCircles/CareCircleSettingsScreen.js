import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Users, UserPlus, Copy, Archive, RotateCcw, Crown, LogOut, Trash2, ChevronRight, Bell } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { Card, Input, Btn, Sect } from '../../components/UI';
import {
  getCircle, updateCircle, archiveCircle, restoreCircle, deleteCircle,
  duplicateCircle, leaveCircle, transferOwnership, listMembers,
} from '../../services/careCircleService';

export default function CareCircleSettingsScreen({ route, navigation }) {
  const { colors } = useTheme();
  const { circleId, justCreated } = route.params || {};
  const [circle, setCircle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [transferPicker, setTransferPicker] = useState(false);
  const [members, setMembers] = useState([]);

  const load = useCallback(async () => {
    try {
      const c = await getCircle(circleId);
      setCircle(c);
      setNameDraft(c.name);
    } catch (e) {
      Alert.alert('Error', 'Could not load this Care Circle.');
      navigation.goBack();
    } finally { setLoading(false); }
  }, [circleId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function saveName() {
    if (!nameDraft.trim()) return;
    setBusy(true);
    try {
      const updated = await updateCircle(circleId, { name: nameDraft.trim() });
      setCircle(updated);
      setEditingName(false);
    } catch (e) {
      Alert.alert('Couldn\'t rename', e.message);
    } finally { setBusy(false); }
  }

  async function handleArchive() {
    setBusy(true);
    try { setCircle(await archiveCircle(circleId)); }
    catch (e) { Alert.alert('Couldn\'t archive', e.message); }
    finally { setBusy(false); }
  }

  async function handleRestore() {
    setBusy(true);
    try { setCircle(await restoreCircle(circleId)); }
    catch (e) { Alert.alert('Couldn\'t restore', e.message); }
    finally { setBusy(false); }
  }

  function confirmDelete() {
    Alert.alert(
      'Delete this Care Circle?',
      `"${circle.name}" will be moved to trash. You can restore it later from Archived circles, or it'll be gone for good.`,
      [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: handleDelete }],
    );
  }
  async function handleDelete() {
    setBusy(true);
    try {
      await deleteCircle(circleId);
      navigation.navigate('CareCircles');
    } catch (e) { Alert.alert('Couldn\'t delete', e.message); setBusy(false); }
  }

  async function handleDuplicate() {
    setBusy(true);
    try {
      const copy = await duplicateCircle(circleId, false);
      Alert.alert('Duplicated', `"${copy.name}" was created with the same structure (medicines/bills/history are not copied).`);
      navigation.navigate('CareCircles');
    } catch (e) { Alert.alert('Couldn\'t duplicate', e.message); }
    finally { setBusy(false); }
  }

  function confirmLeave() {
    Alert.alert('Leave this Care Circle?', `You'll lose access to "${circle.name}" until someone invites you back.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: handleLeave },
    ]);
  }
  async function handleLeave() {
    setBusy(true);
    try {
      await leaveCircle(circleId);
      navigation.navigate('CareCircles');
    } catch (e) { Alert.alert('Couldn\'t leave', e.message); setBusy(false); }
  }

  async function openTransferPicker() {
    setBusy(true);
    try {
      const list = await listMembers(circleId);
      setMembers(list.filter(m => !m.isOwner));
      if (!list.filter(m => !m.isOwner).length) {
        Alert.alert('No one to transfer to', 'Invite another member first, then you can transfer ownership to them.');
        return;
      }
      setTransferPicker(true);
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setBusy(false); }
  }

  function confirmTransfer(member) {
    Alert.alert(
      'Transfer ownership?',
      `${member.name} will become the owner of "${circle.name}". You'll remain a member with regular permissions.`,
      [{ text: 'Cancel', style: 'cancel' }, { text: 'Transfer', style: 'destructive', onPress: () => doTransfer(member) }],
    );
  }
  async function doTransfer(member) {
    setBusy(true); setTransferPicker(false);
    try {
      const updated = await transferOwnership(circleId, member.userId);
      setCircle(updated);
      Alert.alert('Done', `${member.name} is now the owner.`);
    } catch (e) { Alert.alert('Couldn\'t transfer', e.message); }
    finally { setBusy(false); }
  }

  if (loading || !circle) {
    return <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={colors.primary} /></SafeAreaView>;
  }

  const isArchived = circle.status === 'archived';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView style={{ flex: 1, padding: 16 }} contentContainerStyle={{ paddingBottom: 40 }}>
        <TouchableOpacity onPress={() => navigation.navigate('CareCircles')} style={{ marginBottom: 12 }}>
          <Text style={{ color: colors.muted, fontSize: 13 }}>← Care Circles</Text>
        </TouchableOpacity>

        {justCreated && (
          <Card style={{ backgroundColor: 'rgba(34,197,94,.10)', borderColor: 'rgba(34,197,94,.3)' }}>
            <Text style={{ color: colors.emerald, fontWeight: '600', fontSize: 13 }}>🎉 "{circle.name}" created and set as your active circle.</Text>
          </Card>
        )}

        <View style={{ alignItems: 'center', marginBottom: 20 }}>
          <Text style={{ fontSize: 44, marginBottom: 8 }}>{circle.icon}</Text>
          {editingName ? (
            <View style={{ width: '100%' }}>
              <Input value={nameDraft} onChangeText={setNameDraft} />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Btn size="sm" variant="outline" onPress={() => { setEditingName(false); setNameDraft(circle.name); }} style={{ flex: 1 }}>Cancel</Btn>
                <Btn size="sm" onPress={saveName} loading={busy} style={{ flex: 1 }}>Save</Btn>
              </View>
            </View>
          ) : (
            <TouchableOpacity onPress={() => setEditingName(true)}>
              <Text style={{ fontWeight: '800', fontSize: 20, color: colors.ink }}>{circle.name} ✏️</Text>
            </TouchableOpacity>
          )}
          {isArchived && <Text style={{ fontSize: 12, color: colors.amber, fontWeight: '700', marginTop: 6 }}>📦 Archived</Text>}
        </View>

        <Sect title="People">
          <TouchableOpacity onPress={() => navigation.navigate('CareCircleMembers', { circleId })}>
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Users size={20} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700', fontSize: 14, color: colors.ink }}>Members & permissions</Text>
                <Text style={{ fontSize: 12, color: colors.muted }}>Roles, primary contact, blocked users</Text>
              </View>
              <ChevronRight size={18} color={colors.muted} />
            </Card>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('InviteToCircle', { circleId, circleName: circle.name })}>
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <UserPlus size={20} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700', fontSize: 14, color: colors.ink }}>Invite people</Text>
                <Text style={{ fontSize: 12, color: colors.muted }}>QR code, email, phone, WhatsApp, SMS, or link</Text>
              </View>
              <ChevronRight size={18} color={colors.muted} />
            </Card>
          </TouchableOpacity>
        </Sect>

        <Sect title="Alerts">
          <TouchableOpacity onPress={() => navigation.navigate('EscalationSettings', { circleId })}>
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Bell size={20} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700', fontSize: 14, color: colors.ink }}>Smart Escalation</Text>
                <Text style={{ fontSize: 12, color: colors.muted }}>Missed medicine → remind, then notify family in order</Text>
              </View>
              <ChevronRight size={18} color={colors.muted} />
            </Card>
          </TouchableOpacity>
        </Sect>

        <Sect title="Manage circle">
          <TouchableOpacity onPress={handleDuplicate} disabled={busy}>
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Copy size={20} color={colors.primary} />
              <Text style={{ fontWeight: '700', fontSize: 14, color: colors.ink, flex: 1 }}>Duplicate circle</Text>
            </Card>
          </TouchableOpacity>

          {circle.isOwner && (
            <TouchableOpacity onPress={openTransferPicker} disabled={busy}>
              <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Crown size={20} color={colors.amber} />
                <Text style={{ fontWeight: '700', fontSize: 14, color: colors.ink, flex: 1 }}>Transfer ownership</Text>
              </Card>
            </TouchableOpacity>
          )}

          {transferPicker && (
            <Card>
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.muted, marginBottom: 8 }}>TRANSFER TO WHOM?</Text>
              {members.map(m => (
                <TouchableOpacity key={m.userId} onPress={() => confirmTransfer(m)} style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                  <Text style={{ fontSize: 14, color: colors.ink, fontWeight: '600' }}>{m.name}</Text>
                  <Text style={{ fontSize: 11, color: colors.muted }}>{m.role} · {m.email || m.phone}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity onPress={() => setTransferPicker(false)} style={{ marginTop: 8 }}>
                <Text style={{ color: colors.muted, fontSize: 12, textAlign: 'center' }}>Cancel</Text>
              </TouchableOpacity>
            </Card>
          )}

          {isArchived ? (
            <TouchableOpacity onPress={handleRestore} disabled={busy}>
              <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <RotateCcw size={20} color={colors.emerald} />
                <Text style={{ fontWeight: '700', fontSize: 14, color: colors.emerald, flex: 1 }}>Restore circle</Text>
              </Card>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={handleArchive} disabled={busy}>
              <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Archive size={20} color={colors.muted} />
                <Text style={{ fontWeight: '700', fontSize: 14, color: colors.ink, flex: 1 }}>Archive circle</Text>
              </Card>
            </TouchableOpacity>
          )}
        </Sect>

        <Sect title="Danger zone">
          {!circle.isOwner && (
            <TouchableOpacity onPress={confirmLeave} disabled={busy}>
              <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderColor: 'rgba(255,77,106,.3)' }}>
                <LogOut size={20} color={colors.rose} />
                <Text style={{ fontWeight: '700', fontSize: 14, color: colors.rose, flex: 1 }}>Leave circle</Text>
              </Card>
            </TouchableOpacity>
          )}
          {circle.isOwner && (
            <TouchableOpacity onPress={confirmDelete} disabled={busy}>
              <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderColor: 'rgba(255,77,106,.3)' }}>
                <Trash2 size={20} color={colors.rose} />
                <Text style={{ fontWeight: '700', fontSize: 14, color: colors.rose, flex: 1 }}>Delete circle</Text>
              </Card>
            </TouchableOpacity>
          )}
        </Sect>
      </ScrollView>
    </SafeAreaView>
  );
}
