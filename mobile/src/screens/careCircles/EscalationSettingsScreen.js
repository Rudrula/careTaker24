import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Switch, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Plus, Trash2, ChevronUp, ChevronDown, User, Phone } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { useData } from '../../context/DataContext';
import { Card, Btn, Sect } from '../../components/UI';
import { getEscalationPolicy, saveEscalationPolicy } from '../../services/escalationService';
import { listMembers } from '../../services/careCircleService';

export default function EscalationSettingsScreen({ route, navigation }) {
  const { colors } = useTheme();
  const { data } = useData();
  const { circleId } = route.params || {};

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [reminderRepeatCount, setReminderRepeatCount] = useState('3');
  const [reminderIntervalMinutes, setReminderIntervalMinutes] = useState('10');
  const [steps, setSteps] = useState([]); // { targetType, targetId, label, waitMinutes }
  const [members, setMembers] = useState([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTab, setPickerTab] = useState('member');

  const load = useCallback(async () => {
    try {
      const [policy, memberList] = await Promise.all([getEscalationPolicy(), listMembers(circleId)]);
      setEnabled(!!policy.enabled);
      setReminderRepeatCount(String(policy.reminderRepeatCount ?? 3));
      setReminderIntervalMinutes(String(policy.reminderIntervalMinutes ?? 10));
      setSteps((policy.steps || []).map(s => ({ ...s })));
      setMembers(memberList);
    } catch (e) {
      Alert.alert('Error', 'Could not load escalation settings.');
    } finally { setLoading(false); }
  }, [circleId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  function addStep(target) {
    setSteps(prev => [...prev, { targetType: target.targetType, targetId: target.targetId, label: target.label, waitMinutes: 15 }]);
    setPickerOpen(false);
  }

  function removeStep(index) {
    setSteps(prev => prev.filter((_, i) => i !== index));
  }

  function moveStep(index, dir) {
    setSteps(prev => {
      const next = [...prev];
      const swapWith = index + dir;
      if (swapWith < 0 || swapWith >= next.length) return prev;
      [next[index], next[swapWith]] = [next[swapWith], next[index]];
      return next;
    });
  }

  function updateWaitMinutes(index, value) {
    const n = parseInt(value, 10);
    setSteps(prev => prev.map((s, i) => i === index ? { ...s, waitMinutes: Number.isFinite(n) ? n : s.waitMinutes } : s));
  }

  async function handleSave() {
    const repeatCount = parseInt(reminderRepeatCount, 10);
    const interval = parseInt(reminderIntervalMinutes, 10);
    if (!Number.isFinite(repeatCount) || repeatCount < 0 || repeatCount > 10) { Alert.alert('Invalid value', 'Reminder repeat count must be 0–10.'); return; }
    if (!Number.isFinite(interval) || interval < 1 || interval > 180) { Alert.alert('Invalid value', 'Reminder interval must be 1–180 minutes.'); return; }

    setSaving(true);
    try {
      await saveEscalationPolicy({
        enabled, reminderRepeatCount: repeatCount, reminderIntervalMinutes: interval,
        steps: steps.map(s => ({ targetType: s.targetType, targetId: s.targetId, label: s.label, waitMinutes: s.waitMinutes })),
      });
      Alert.alert('Saved', 'Escalation settings updated.');
    } catch (e) {
      Alert.alert('Couldn\'t save', e.message || 'Please try again.');
    } finally { setSaving(false); }
  }

  if (loading) return <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={colors.primary} /></SafeAreaView>;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView style={{ flex: 1, padding: 16 }} contentContainerStyle={{ paddingBottom: 40 }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginBottom: 12 }}>
          <Text style={{ color: colors.muted, fontSize: 13 }}>← Back</Text>
        </TouchableOpacity>
        <Text style={{ fontWeight: '800', fontSize: 20, color: colors.ink, marginBottom: 4 }}>Smart Escalation</Text>
        <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 16 }}>
          If a medicine is missed, remind them a few times — then automatically work through your family, in order, until someone responds.
        </Text>

        <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '700', fontSize: 15, color: colors.ink }}>Enable Smart Escalation</Text>
            <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>Works even if nobody has the app open</Text>
          </View>
          <Switch value={enabled} onValueChange={setEnabled} trackColor={{ true: colors.primary }} />
        </Card>

        {enabled && (
          <>
            <Sect title="Step 1 — Remind them">
              <Card>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: colors.muted, marginBottom: 6 }}>Repeat reminder</Text>
                    <TextInput value={reminderRepeatCount} onChangeText={setReminderRepeatCount} keyboardType="number-pad"
                      style={{ borderWidth: 1.5, borderColor: colors.border, borderRadius: 10, padding: 10, color: colors.ink, backgroundColor: colors.cardAlt, textAlign: 'center', fontSize: 16, fontWeight: '700' }} />
                    <Text style={{ fontSize: 11, color: colors.muted, marginTop: 4, textAlign: 'center' }}>times</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: colors.muted, marginBottom: 6 }}>Every</Text>
                    <TextInput value={reminderIntervalMinutes} onChangeText={setReminderIntervalMinutes} keyboardType="number-pad"
                      style={{ borderWidth: 1.5, borderColor: colors.border, borderRadius: 10, padding: 10, color: colors.ink, backgroundColor: colors.cardAlt, textAlign: 'center', fontSize: 16, fontWeight: '700' }} />
                    <Text style={{ fontSize: 11, color: colors.muted, marginTop: 4, textAlign: 'center' }}>minutes</Text>
                  </View>
                </View>
              </Card>
            </Sect>

            <Sect title="Step 2 — Then notify, in order" action={<TouchableOpacity onPress={() => setPickerOpen(v => !v)}><Plus size={22} color={colors.primary} /></TouchableOpacity>}>
              {pickerOpen && (
                <Card>
                  <View style={{ flexDirection: 'row', backgroundColor: colors.cardAlt, borderRadius: 10, padding: 3, marginBottom: 12 }}>
                    {[['member', '👤 Family member'], ['contact', '📇 Contact']].map(([k, l]) => (
                      <TouchableOpacity key={k} onPress={() => setPickerTab(k)} style={{ flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: pickerTab === k ? colors.card : 'transparent', alignItems: 'center' }}>
                        <Text style={{ fontSize: 12, fontWeight: '600', color: pickerTab === k ? colors.primary : colors.muted }}>{l}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {pickerTab === 'member' ? (
                    members.map(m => (
                      <TouchableOpacity key={m.userId} onPress={() => addStep({ targetType: 'member', targetId: m.userId, label: m.name })} style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.ink }}>{m.name}</Text>
                        <Text style={{ fontSize: 11, color: colors.muted }}>{m.role}</Text>
                      </TouchableOpacity>
                    ))
                  ) : (
                    (data.contacts || []).map(c => (
                      <TouchableOpacity key={c.id} onPress={() => addStep({ targetType: 'contact', targetId: c.id, label: c.name })} style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.ink }}>{c.name}</Text>
                        <Text style={{ fontSize: 11, color: colors.muted }}>{c.relation} · {c.phone}</Text>
                      </TouchableOpacity>
                    ))
                  )}
                  {((pickerTab === 'member' && !members.length) || (pickerTab === 'contact' && !(data.contacts || []).length)) && (
                    <Text style={{ fontSize: 12, color: colors.muted, textAlign: 'center', paddingVertical: 10 }}>Nothing here yet.</Text>
                  )}
                </Card>
              )}

              {steps.length === 0 && !pickerOpen && (
                <Text style={{ fontSize: 13, color: colors.muted, textAlign: 'center', marginVertical: 8 }}>No one added yet — tap + to build the chain.</Text>
              )}

              {steps.map((s, i) => (
                <Card key={`${s.targetType}-${s.targetId}-${i}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ width: 26, height: 26, borderRadius: 99, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: colors.primary }}>{i + 1}</Text>
                  </View>
                  {s.targetType === 'member' ? <User size={16} color={colors.muted} /> : <Phone size={16} color={colors.muted} />}
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: colors.ink }}>Notify {s.label}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                      <Text style={{ fontSize: 11, color: colors.muted }}>Wait</Text>
                      <TextInput value={String(s.waitMinutes)} onChangeText={v => updateWaitMinutes(i, v)} keyboardType="number-pad"
                        style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, color: colors.ink, fontSize: 11, width: 40, textAlign: 'center' }} />
                      <Text style={{ fontSize: 11, color: colors.muted }}>min for a response</Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 2 }}>
                    <TouchableOpacity onPress={() => moveStep(i, -1)} disabled={i === 0} style={{ padding: 4, opacity: i === 0 ? 0.3 : 1 }}><ChevronUp size={16} color={colors.muted} /></TouchableOpacity>
                    <TouchableOpacity onPress={() => moveStep(i, 1)} disabled={i === steps.length - 1} style={{ padding: 4, opacity: i === steps.length - 1 ? 0.3 : 1 }}><ChevronDown size={16} color={colors.muted} /></TouchableOpacity>
                    <TouchableOpacity onPress={() => removeStep(i)} style={{ padding: 4 }}><Trash2 size={16} color={colors.rose} /></TouchableOpacity>
                  </View>
                </Card>
              ))}

              {steps.length > 0 && (
                <Text style={{ fontSize: 11, color: colors.muted, marginTop: 4 }}>
                  If {steps[steps.length - 1]?.label} doesn't respond within {steps[steps.length - 1]?.waitMinutes} min, the chain stops and is marked unresolved.
                </Text>
              )}
            </Sect>
          </>
        )}

        <Btn full loading={saving} onPress={handleSave} style={{ marginTop: 8 }}>Save Escalation Settings</Btn>
      </ScrollView>
    </SafeAreaView>
  );
}
