import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Plus } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { Card, Input, Btn } from '../../components/UI';
import { getCareTimeline, addCareEvent, updateCareEvent, deleteCareEvent, EVENT_TYPES } from '../../services/careEventService';
import { listCircles, setActiveCircle } from '../../services/careCircleService';

const SEVERITY_STYLE = [
  { bg: 'rgba(255,77,106,.12)', border: 'rgba(255,77,106,.35)' },   // 0: missed dose
  { bg: 'rgba(245,158,11,.12)', border: 'rgba(245,158,11,.35)' },   // 1: low stock
  { bg: 'rgba(59,130,246,.10)', border: 'rgba(59,130,246,.3)' },    // 2: upcoming event
  { bg: 'rgba(34,197,94,.10)', border: 'rgba(34,197,94,.3)' },      // 3: all taken
];

export default function CareTimelineScreen({ navigation }) {
  const { colors } = useTheme();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [circles, setCircles] = useState([]);
  const [form, setForm] = useState({ circleId: '', title: '', type: 'appointment', date: '', time: '', notes: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [timeline, myCircles] = await Promise.all([getCareTimeline(), listCircles()]);
      setItems(timeline || []);
      setCircles((myCircles || []).filter(c => c.status === 'active'));
    } catch (e) {
      // Offline — leave whatever was last loaded on screen.
    } finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function handleItemPress(item) {
    // Tapping a summary line jumps into that person's circle for detail —
    // switches active circle first if it isn't already, matching how the
    // rest of the app scopes Home/Medicines/Reminders to one circle at a time.
    try {
      await setActiveCircle(item.circleId);
      navigation.navigate('Home');
    } catch (e) {
      Alert.alert('Error', 'Could not switch to that Care Circle.');
    }
  }

  // Timeline item ids for upcoming events are "event-<CareEvent _id>" (see
  // the backend's /api/care-circles/timeline route) — strip the prefix to
  // get the real id these two mutations need.
  function rawEventId(item) { return item.id.replace(/^event-/, ''); }

  async function handleCompleteEvent(item) {
    try {
      await setActiveCircle(item.circleId);
      await updateCareEvent(rawEventId(item), { completed: true });
      load();
    } catch (e) {
      Alert.alert('Couldn\'t update', e.message || 'Please try again.');
    }
  }

  function confirmDeleteEvent(item) {
    Alert.alert('Remove this event?', item.text, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => handleDeleteEvent(item) },
    ]);
  }
  async function handleDeleteEvent(item) {
    try {
      await setActiveCircle(item.circleId);
      await deleteCareEvent(rawEventId(item));
      load();
    } catch (e) {
      Alert.alert('Couldn\'t remove', e.message || 'Please try again.');
    }
  }

  async function handleAddEvent() {
    if (!form.circleId) { Alert.alert('Pick a Care Circle', 'Choose who this event is for.'); return; }
    if (!form.title.trim() || !form.date) { Alert.alert('Missing info', 'Please enter a title and date.'); return; }
    setSaving(true);
    try {
      const iso = form.time ? `${form.date}T${form.time}:00` : `${form.date}T00:00:00`;
      const dueDate = new Date(iso);
      if (isNaN(dueDate.getTime())) { Alert.alert('Invalid date', 'Use YYYY-MM-DD (and optionally HH:MM for the time).'); setSaving(false); return; }

      // addCareEvent() posts to whichever circle is currently active — if
      // the person picked a different one in the form, switch first.
      const activeCircle = circles.find(c => c.isActive);
      if (!activeCircle || activeCircle.id !== form.circleId) await setActiveCircle(form.circleId);
      await addCareEvent({ title: form.title.trim(), type: form.type, dueDate: dueDate.toISOString(), notes: form.notes });

      setForm({ circleId: '', title: '', type: 'appointment', date: '', time: '', notes: '' });
      setAddOpen(false);
      load();
    } catch (e) {
      Alert.alert('Couldn\'t add event', e.message || 'Please try again.');
    } finally { setSaving(false); }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView style={{ flex: 1, padding: 16 }} contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginBottom: 12 }}>
          <Text style={{ color: colors.muted, fontSize: 13 }}>← Back</Text>
        </TouchableOpacity>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <Text style={{ fontWeight: '800', fontSize: 22, color: colors.ink }}>Care Timeline</Text>
          <TouchableOpacity onPress={() => setAddOpen(v => !v)} style={{ backgroundColor: colors.btnFill, borderRadius: 99, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
            <Plus size={20} color="#fff" />
          </TouchableOpacity>
        </View>
        <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 16 }}>Today's Family Summary — across every circle you care for</Text>

        {addOpen && (
          <Card>
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.muted, marginBottom: 6 }}>For whom?</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
              {circles.map(c => (
                <TouchableOpacity key={c.id} onPress={() => setForm(f => ({ ...f, circleId: c.id }))}
                  style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1.5, borderColor: form.circleId === c.id ? colors.primary : colors.border, backgroundColor: form.circleId === c.id ? colors.primarySoft : colors.cardAlt, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <Text style={{ fontSize: 13 }}>{c.icon}</Text>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: form.circleId === c.id ? colors.primary : colors.muted }}>{c.name}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Input label="Title" value={form.title} onChangeText={t => setForm(f => ({ ...f, title: t }))} placeholder="e.g. Prenatal check-up" />
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.muted, marginBottom: 6 }}>Type</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
              {EVENT_TYPES.map(t => (
                <TouchableOpacity key={t.value} onPress={() => setForm(f => ({ ...f, type: t.value }))}
                  style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1.5, borderColor: form.type === t.value ? colors.primary : colors.border, backgroundColor: form.type === t.value ? colors.primarySoft : colors.cardAlt }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: form.type === t.value ? colors.primary : colors.muted }}>{t.icon} {t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Input label="Date (YYYY-MM-DD)" value={form.date} onChangeText={t => setForm(f => ({ ...f, date: t }))} placeholder="2026-08-01" />
            <Input label="Time (optional, HH:MM 24h)" value={form.time} onChangeText={t => setForm(f => ({ ...f, time: t }))} placeholder="10:30" />
            <Input label="Notes (optional)" value={form.notes} onChangeText={t => setForm(f => ({ ...f, notes: t }))} placeholder="Any extra details" />
            <Btn full loading={saving} onPress={handleAddEvent}>Add to timeline</Btn>
          </Card>
        )}

        {loading && !items.length ? <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} /> : null}

        {!loading && items.length === 0 && (
          <Card>
            <Text style={{ fontSize: 13, color: colors.muted, textAlign: 'center' }}>All clear — nothing needs attention right now. 🎉</Text>
          </Card>
        )}

        {items.map(item => {
          const style = SEVERITY_STYLE[item.severity] || SEVERITY_STYLE[2];
          return (
            <Card key={item.id} style={{ backgroundColor: style.bg, borderColor: style.border }}>
              <TouchableOpacity onPress={() => handleItemPress(item)} activeOpacity={0.7} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                <Text style={{ fontSize: 17 }}>{item.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: colors.ink }}>{item.text}</Text>
                  <Text style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>{item.circleIcon} {item.circleName}</Text>
                </View>
              </TouchableOpacity>
              {item.type === 'upcoming_event' && (
                <View style={{ flexDirection: 'row', gap: 18, marginTop: 10, marginLeft: 27 }}>
                  <TouchableOpacity onPress={() => handleCompleteEvent(item)}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: colors.emerald }}>✓ Mark done</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => confirmDeleteEvent(item)}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: colors.rose }}>Remove</Text>
                  </TouchableOpacity>
                </View>
              )}
            </Card>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}
