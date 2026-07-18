import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch, Alert, ActivityIndicator, Linking, AppState } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { Plus, Camera, Check, Trash2 } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { useData } from '../context/DataContext';
import { Card, Btn, Input, StatusPill, Sect, ChipRow, Toggle } from '../components/UI';
import { scanBillPhoto } from '../services/aiService';
import { reportMissedDose } from '../services/careCircleService';
import { listEscalationEvents, acknowledgeEscalation, ESCALATION_PHASE_LABEL } from '../services/escalationService';
import { medicineFormIcon } from '../utils/medicineForm';
import {
  scheduleMedicineReminder, requestNotificationPermission, sendTestAlarm,
} from '../services/notificationService';

const REMINDER_TYPES = [
  { v: 'water', l: '💧 Water' }, { v: 'exercise', l: '🏃 Exercise' },
  { v: 'medicine', l: '💊 Medicine' }, { v: 'custom', l: '⭐ Custom' },
];
const RECUR_OPTIONS = ['monthly', 'yearly', 'once'];

function fmtTime(t) {
  if (!t) return 'Not set';
  const [h, m] = t.split(':').map(Number);
  if (Number.isNaN(h)) return 'Not set';
  const ap = h >= 12 ? 'PM' : 'AM', h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ap}`;
}
function billStatus(b) {
  if (b.recurring === 'once' && b.paidThisCycle) return 'paid';
  const t = new Date().toISOString().slice(0, 10);
  if (b.dueDate < t) return 'overdue';
  if (b.dueDate === t) return 'due-today';
  return 'upcoming';
}
function medStatus(m) {
  const td = new Date().toDateString();
  if (m.lastTakenDate === td) return 'taken';
  if (m.lastSkippedDate === td) return 'skipped';
  const now = new Date(), mm = now.getHours() * 60 + now.getMinutes();
  const [mh, min] = (m.time || '').split(':').map(Number);
  const mt = Number.isFinite(mh) ? mh * 60 + min : null;
  if (mt !== null && mm > mt + 30) return 'missed';
  return 'pending';
}

export default function RemindersScreen() {
  const { colors } = useTheme();
  const {
    data, markTaken, skipMedicine, postponeMedicine,
    addBill, markBillPaid, deleteBill,
    addReminder, toggleReminder, deleteReminder,
  } = useData();

  const [subTab, setSubTab] = useState('reminders');
  const [alarmsOn, setAlarmsOn] = useState(true);
  const [permGranted, setPermGranted] = useState(false);

  const [addReminderOpen, setAddReminderOpen] = useState(false);
  const [newReminder, setNewReminder] = useState({ title: '', type: 'water', freq: '' });

  const [addBillOpen, setAddBillOpen] = useState(false);
  const [newBill, setNewBill] = useState({ name: '', amount: '', dueDate: '', recurring: 'monthly' });
  const [scanLoading, setScanLoading] = useState(false);
  const [activeEscalations, setActiveEscalations] = useState([]);

  useEffect(() => {
    (async () => { setPermGranted(await requestNotificationPermission()); })();
  }, []);

  // Apps can't flip the OS notification switch on directly — only the
  // person can, in system Settings. This is the standard, correct pattern:
  // deep-link straight to this app's settings page (skips them having to
  // hunt through Settings themselves), then re-check permission status the
  // moment they come back, so the banner disappears immediately if they
  // actually enabled it rather than waiting for the next app restart.
  function openNotificationSettings() {
    Linking.openSettings();
    const sub = AppState.addEventListener('change', async (next) => {
      if (next === 'active') {
        setPermGranted(await requestNotificationPermission());
        sub.remove();
      }
    });
  }

  useEffect(() => {
    if (!alarmsOn || !permGranted) return;
    data.medicines.forEach(m => { scheduleMedicineReminder(m).catch(() => {}); });
  }, [alarmsOn, permGranted, data.medicines]);

  // Polls for any in-progress Smart Escalation runs so the person opening
  // the app can see "we're 2 steps into notifying your family about Dad's
  // missed BP medicine" at a glance, and step in with "I've got this"
  // without waiting for the chain to reach them.
  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try { const events = await listEscalationEvents('active'); if (!cancelled) setActiveEscalations(events); }
      catch (e) { /* offline — keep showing whatever was last fetched */ }
    }
    poll();
    const interval = setInterval(poll, 30 * 1000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  async function handleAcknowledgeEscalation(event) {
    try {
      await acknowledgeEscalation(event.id);
      setActiveEscalations(prev => prev.filter(e => e.id !== event.id));
    } catch (e) {
      Alert.alert('Couldn\'t acknowledge', e.message || 'Please try again.');
    }
  }

  // The moment a medicine's status is newly computed as "missed" (30+ min
  // past its scheduled time with no Take/Skip action), tell the backend so
  // it can push a notification to whoever's flagged as the primary contact
  // for this circle (see CareCircleMembersScreen's ⭐ toggle). There's no
  // server-side scheduler in this backend, so the client — which already
  // computes "missed" locally to render the status pill — is what
  // triggers this. `reportedRef` avoids firing the same call repeatedly
  // within one screen visit; the backend's own lastMissedAlertDate field
  // is the real, durable guard against duplicate notifications across
  // app restarts or multiple family members' phones being open at once.
  const reportedRef = useRef(new Set());
  useEffect(() => {
    data.medicines.forEach(m => {
      const key = `${m.id}:${new Date().toDateString()}`;
      if (medStatus(m) === 'missed' && !reportedRef.current.has(key)) {
        reportedRef.current.add(key);
        reportMissedDose(m.id).catch(() => {}); // best-effort — a failed alert shouldn't disrupt the UI
      }
    });
  }, [data.medicines]);

  function submitReminder() {
    if (!newReminder.title.trim()) return;
    addReminder(newReminder);
    setNewReminder({ title: '', type: 'water', freq: '' });
    setAddReminderOpen(false);
  }

  function submitBill() {
    if (!newBill.name.trim() || !newBill.dueDate) return;
    addBill(newBill);
    setNewBill({ name: '', amount: '', dueDate: '', recurring: 'monthly' });
    setAddBillOpen(false);
  }

  function confirmDeleteBill(bill) {
    Alert.alert('Delete bill', `Remove ${bill.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteBill(bill.id) },
    ]);
  }

  function confirmDeleteReminder(reminder) {
    Alert.alert('Delete reminder', `Remove "${reminder.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteReminder(reminder.id) },
    ]);
  }

  async function scanBill() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert('Camera permission needed', 'Enable camera access in Settings to scan a bill.'); return; }
    const result = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.7, allowsEditing: true });
    if (result.canceled) return;
    const asset = result.assets[0];
    setScanLoading(true);
    try {
      const base64 = asset.base64 || await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
      const parsed = await scanBillPhoto(base64, 'image/jpeg');
      setNewBill({
        name: parsed.name || '', amount: parsed.amount || '',
        dueDate: parsed.dueDate || '', recurring: RECUR_OPTIONS.includes(parsed.recurring) ? parsed.recurring : 'monthly',
      });
      setAddBillOpen(true);
    } catch (e) {
      Alert.alert('Scan failed', "Couldn't read the bill clearly — please fill in the details manually.");
    } finally { setScanLoading(false); }
  }

  function handlePostpone(med) {
    Alert.alert('Postpone reminder', `Remind again for ${med.name} in how long?`, [
      { text: '15 minutes', onPress: () => postponeMedicine(med, 15) },
      { text: '30 minutes', onPress: () => postponeMedicine(med, 30) },
      { text: '1 hour', onPress: () => postponeMedicine(med, 60) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  const statusStyle = {
    taken: ['Taken ✓', 'rgba(34,197,94,.12)', colors.emerald],
    skipped: ['Skipped', 'rgba(148,163,184,.18)', colors.muted],
    missed: ['Missed', 'rgba(255,77,106,.12)', colors.rose],
    pending: ['Pending', 'rgba(245,158,11,.12)', colors.amber],
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView style={{ flex: 1, padding: 16 }} contentContainerStyle={{ paddingBottom: 40 }}>
        <Text style={{ fontWeight: '800', fontSize: 20, color: colors.ink, marginBottom: 4 }}>Reminders</Text>
        <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 16 }}>Real OS alarms — fire even if the app is closed</Text>

        <View style={{ flexDirection: 'row', backgroundColor: colors.greyLt, borderRadius: 12, padding: 3, marginBottom: 16 }}>
          {[['reminders', '🔔 Reminders'], ['bills', '💳 Bills']].map(([k, l]) => (
            <TouchableOpacity key={k} onPress={() => setSubTab(k)} style={{ flex: 1, paddingVertical: 8, borderRadius: 10, backgroundColor: subTab === k ? colors.card : 'transparent', alignItems: 'center' }}>
              <Text style={{ fontWeight: '600', fontSize: 13, color: subTab === k ? colors.primary : colors.muted }}>{l}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {subTab === 'reminders' && (
          <>
            {!permGranted && (
              <TouchableOpacity onPress={openNotificationSettings}>
                <Card style={{ backgroundColor: 'rgba(245,158,11,.10)', borderColor: 'rgba(245,158,11,.3)', flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Text style={{ fontSize: 20 }}>⚠️</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: colors.amber }}>Notifications are turned off</Text>
                    <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>Reminders won't fire until enabled. Tap to open Settings →</Text>
                  </View>
                </Card>
              </TouchableOpacity>
            )}

            {activeEscalations.length > 0 && (
              <Sect title="🔔 Escalation in progress">
                {activeEscalations.map(ev => (
                  <Card key={ev.id} style={{ backgroundColor: 'rgba(255,77,106,.10)', borderColor: 'rgba(255,77,106,.3)' }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: colors.ink }}>{ev.medicineName} was missed</Text>
                    <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>
                      {ESCALATION_PHASE_LABEL[ev.phase] || ev.phase}
                      {ev.phase === 'reminders' && ` — reminder ${ev.reminderCount} of ${ev.policySnapshot?.reminderRepeatCount}`}
                      {ev.phase === 'escalating' && ev.policySnapshot?.steps?.[ev.stepIndex] && ` — notifying ${ev.policySnapshot.steps[ev.stepIndex].label}`}
                    </Text>
                    <Btn size="sm" variant="outline" onPress={() => handleAcknowledgeEscalation(ev)} style={{ marginTop: 8, alignSelf: 'flex-start' }}>I've got this ✓</Btn>
                  </Card>
                ))}
              </Sect>
            )}

            <Card style={{ paddingVertical: 4 }}>
              <Toggle on={alarmsOn} onToggle={() => setAlarmsOn(v => !v)} label="🔔 Medicine alarms" />
            </Card>

            <TouchableOpacity onPress={() => sendTestAlarm().catch(() => {})} style={{ alignSelf: 'flex-start', marginBottom: 4 }}>
              <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600' }}>🔊 Test alarm sound & actions</Text>
            </TouchableOpacity>

            <Sect title="Medicine schedule">
              {data.medicines.map(m => {
                const status = medStatus(m);
                const [label, bg, fg] = statusStyle[status];
                const isDone = status === 'taken' || status === 'skipped';
                return (
                  <Card key={m.id}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: isDone ? 0 : 10 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: '600', fontSize: 14, color: colors.ink }}>{medicineFormIcon(m.form)} {m.name} · {m.dosage}</Text>
                        <Text style={{ fontSize: 12, color: colors.muted }}>⏰ {fmtTime(m.time)}{m.instructions ? ` · ${m.instructions}` : ''}</Text>
                      </View>
                      <StatusPill label={label} bg={bg} fg={fg} />
                    </View>
                    {!isDone && (
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <Btn size="sm" variant="outline" onPress={() => skipMedicine(m)} style={{ flex: 1 }}>⏭ Skip</Btn>
                        <Btn size="sm" variant="outline" onPress={() => handlePostpone(m)} style={{ flex: 1 }}>⏰ Snooze</Btn>
                        <Btn size="sm" onPress={() => markTaken(m)} style={{ flex: 1 }}>✅ Take</Btn>
                      </View>
                    )}
                  </Card>
                );
              })}
              {data.medicines.length === 0 && <Text style={{ color: colors.muted, fontSize: 13 }}>No medicines scheduled yet — add one from the Medicines tab.</Text>}
            </Sect>

            <Sect title="All reminders" action={<TouchableOpacity onPress={() => setAddReminderOpen(v => !v)}><Plus size={22} color={colors.primary} /></TouchableOpacity>}>
              {addReminderOpen && (
                <Card>
                  <Input label="Reminder title" value={newReminder.title} onChangeText={t => setNewReminder(r => ({ ...r, title: t }))} placeholder="e.g. Take prenatal vitamin" />
                  <Text style={{ fontSize: 12, fontWeight: '600', color: colors.muted, marginBottom: 6 }}>Type</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                    {REMINDER_TYPES.map(t => (
                      <TouchableOpacity key={t.v} onPress={() => setNewReminder(r => ({ ...r, type: t.v }))}
                        style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1.5, borderColor: newReminder.type === t.v ? colors.primary : colors.border, backgroundColor: newReminder.type === t.v ? colors.primarySoft : colors.card }}>
                        <Text style={{ fontSize: 12, fontWeight: '600', color: newReminder.type === t.v ? colors.primary : colors.muted }}>{t.l}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Input label="Frequency" value={newReminder.freq} onChangeText={t => setNewReminder(r => ({ ...r, freq: t }))} placeholder="e.g. Every 2 hours" />
                  <Btn full onPress={submitReminder}>Add Reminder</Btn>
                </Card>
              )}
              {(data.reminders || []).map(r => (
                <Card key={r.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '600', fontSize: 14, color: colors.ink }}>{r.title}</Text>
                    <Text style={{ fontSize: 12, color: colors.muted }}>🕐 {r.freq}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <StatusPill label={r.type} bg={colors.greyLt} fg={colors.muted} />
                    <Switch value={r.active} onValueChange={() => toggleReminder(r.id)} trackColor={{ true: colors.primary }} />
                    <TouchableOpacity onPress={() => confirmDeleteReminder(r)}><Trash2 size={16} color={colors.grey} /></TouchableOpacity>
                  </View>
                </Card>
              ))}
              {(data.reminders || []).length === 0 && <Text style={{ color: colors.muted, fontSize: 13 }}>No custom reminders yet — tap + to add water, exercise, or custom nudges.</Text>}
            </Sect>
          </>
        )}

        {subTab === 'bills' && (
          <Sect title="Bills & payments" action={
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <TouchableOpacity onPress={scanBill} disabled={scanLoading} style={{ backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                {scanLoading ? <ActivityIndicator size="small" color={colors.primary} /> : <Camera size={13} color={colors.primary} />}
                <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 12 }}>AI Scan</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setAddBillOpen(v => !v)}><Plus size={22} color={colors.primary} /></TouchableOpacity>
            </View>
          }>
            {addBillOpen && (
              <Card>
                <Input label="Bill name" value={newBill.name} onChangeText={t => setNewBill(b => ({ ...b, name: t }))} placeholder="e.g. Electricity Bill" />
                <Input label="Amount" value={newBill.amount} onChangeText={t => setNewBill(b => ({ ...b, amount: t }))} placeholder="₹1,200" />
                <Input label="Due date (YYYY-MM-DD)" value={newBill.dueDate} onChangeText={t => setNewBill(b => ({ ...b, dueDate: t }))} placeholder="2026-08-01" />
                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.muted, marginBottom: 6 }}>Recurrence</Text>
                <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
                  {RECUR_OPTIONS.map(v => (
                    <TouchableOpacity key={v} onPress={() => setNewBill(b => ({ ...b, recurring: v }))}
                      style={{ flex: 1, paddingVertical: 7, borderRadius: 8, borderWidth: 1.5, borderColor: newBill.recurring === v ? colors.primary : colors.border, backgroundColor: newBill.recurring === v ? colors.primarySoft : colors.card, alignItems: 'center' }}>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: newBill.recurring === v ? colors.primary : colors.muted }}>{v}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Btn full onPress={submitBill} disabled={!newBill.name.trim() || !newBill.dueDate}>Add Bill</Btn>
              </Card>
            )}
            {(data.bills || []).map(b => {
              const status = billStatus(b);
              const map = { paid: ['Paid', colors.emerald], overdue: ['Overdue', colors.rose], 'due-today': ['Due today', colors.amber], upcoming: ['Upcoming', colors.muted] };
              const [label, color] = map[status];
              return (
                <Card key={b.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '600', fontSize: 14, color: colors.ink }}>{b.name}</Text>
                    <Text style={{ fontSize: 12, color: colors.muted }}>{b.amount} · {b.dueDate} · {b.recurring}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <StatusPill label={label} bg={colors.greyLt} fg={color} />
                    {status !== 'paid' && (
                      <TouchableOpacity onPress={() => markBillPaid(b)} style={{ backgroundColor: colors.emerald, borderRadius: 99, width: 30, height: 30, alignItems: 'center', justifyContent: 'center' }}>
                        <Check size={14} color="#fff" />
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={() => confirmDeleteBill(b)}><Trash2 size={16} color={colors.grey} /></TouchableOpacity>
                  </View>
                </Card>
              );
            })}
            {(data.bills || []).length === 0 && <Text style={{ color: colors.muted, fontSize: 13 }}>No bills added yet.</Text>}
          </Sect>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
