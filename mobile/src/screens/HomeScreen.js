import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Check, ChevronRight, Sparkles, RefreshCw, X, Star } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { useData, todayStr } from '../context/DataContext';
import { Card, Btn, StatusPill } from '../components/UI';
import { SunArc } from '../components/Visuals';
import AppHeader from '../components/AppHeader';
import SOSButton from '../components/SOSButton';
import VoiceButton from '../components/VoiceButton';
import VoiceModal from '../components/VoiceModal';
import ChatModal from '../components/ChatModal';
import SOSWhatsAppModal from '../components/SOSWhatsAppModal';
import { STEP_GOAL } from '../theme/theme';
import { useStepTracking } from '../hooks/useStepTracking';
import { generateDailyDigest } from '../services/aiService';
import { getCareTimeline } from '../services/careEventService';
import { listCircles, setActiveCircle } from '../services/careCircleService';
import { medicineFormIcon } from '../utils/medicineForm';

function fmtTime(t) {
  if (!t) return 'Not set';
  const [h, m] = t.split(':').map(Number);
  if (Number.isNaN(h)) return 'Not set';
  const ap = h >= 12 ? 'PM' : 'AM', h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ap}`;
}
function timeAgo(iso) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

export default function HomeScreen({ navigation }) {
  const { colors } = useTheme();
  const { data, markTaken, skipMedicine, postponeMedicine, checkIn, triggerSOS, logSteps } = useData();
  const [mode, setMode] = useState('senior');
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [sosWhatsAppOpen, setSosWhatsAppOpen] = useState(false);
  const [sosMapsLink, setSosMapsLink] = useState(null);
  const { tracking, toggleTracking } = useStepTracking(logSteps);
  const [digestText, setDigestText] = useState('');
  const [digestLoading, setDigestLoading] = useState(false);

  const td = new Date().toDateString();
  const takenToday = data.medicines.filter(m => m.lastTakenDate === td).length;
  const adherePct = data.medicines.length ? Math.round((takenToday / data.medicines.length) * 100) : 100;
  const nextMed = data.medicines.filter(m => m.lastTakenDate !== td).sort((a, b) => a.time.localeCompare(b.time))[0];
  const todaySteps = data.reports?.[0]?.steps || 0;

  async function handleSOS() {
    Alert.alert('Emergency SOS', 'Alert your family now?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Send Alert', style: 'destructive', onPress: async () => {
          const result = await triggerSOS();
          setSosMapsLink(result?.mapsLink || null);
          Alert.alert('Family notified', 'Your emergency contacts have been alerted.', [
            { text: 'OK', onPress: () => setSosWhatsAppOpen(true) },
          ]);
        },
      },
    ]);
  }

  async function generateDigest() {
    setDigestLoading(true);
    try {
      const snap = {
        seniorName: data.family.seniorName,
        medicines: data.medicines.map(m => ({ name: m.name, status: m.lastTakenDate === todayStr() ? 'taken' : 'not taken yet' })),
        lastCheckIn: data.activityLog.find(a => a.type === 'checkin') ? timeAgo(data.activityLog.find(a => a.type === 'checkin').ts) : 'no check-in today',
      };
      const t = await generateDailyDigest(snap);
      setDigestText(t);
    } finally { setDigestLoading(false); }
  }

  function handlePostpone(med) {
    Alert.alert('Postpone reminder', `Remind again for ${med.name} in how long?`, [
      { text: '15 minutes', onPress: () => postponeMedicine(med, 15) },
      { text: '30 minutes', onPress: () => postponeMedicine(med, 30) },
      { text: '1 hour', onPress: () => postponeMedicine(med, 60) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <AppHeader tier={data.family.tier} mode={mode} setMode={setMode} onOpenChat={() => setChatOpen(true)} onOpenPlans={() => navigation.navigate('Account', { screen: 'Plans' })} />
      <ScrollView style={{ flex: 1, padding: 16 }} contentContainerStyle={{ paddingBottom: 100 }}>
        {mode === 'senior' ? (
          <SeniorView data={data} nextMed={nextMed} takenToday={takenToday} adherePct={adherePct} todaySteps={todaySteps}
            tracking={tracking} toggleTracking={toggleTracking} onCheckIn={checkIn} onMarkTaken={markTaken}
            onSkip={skipMedicine} onPostpone={handlePostpone} navigation={navigation} />
        ) : (
          <FamilyView data={data} adherePct={adherePct} nextMed={nextMed} todaySteps={todaySteps}
            digestText={digestText} digestLoading={digestLoading} onDigest={generateDigest} navigation={navigation} />
        )}
      </ScrollView>
      <VoiceButton onPress={() => setVoiceOpen(true)} />
      <SOSButton onPress={handleSOS} />
      <VoiceModal visible={voiceOpen} onClose={() => setVoiceOpen(false)} />
      <ChatModal visible={chatOpen} onClose={() => setChatOpen(false)} />
      <SOSWhatsAppModal
        visible={sosWhatsAppOpen}
        onClose={() => setSosWhatsAppOpen(false)}
        contacts={data.contacts}
        seniorName={data.family.seniorName}
        mapsLink={sosMapsLink}
      />
    </SafeAreaView>
  );
}

function SeniorView({ data, nextMed, takenToday, adherePct, todaySteps, tracking, toggleTracking, onCheckIn, onMarkTaken, onSkip, onPostpone, navigation }) {
  const { colors } = useTheme();
  const h = new Date().getHours();
  const greet = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  return (
    <>
      <Text style={{ fontSize: 26, fontWeight: '800', color: colors.ink, marginBottom: 2 }}>{greet}, {data.family.seniorName.split(' ')[0]}</Text>
      <Text style={{ fontSize: 15, color: colors.muted, marginBottom: 14 }}>How are you feeling today?</Text>

      <Btn full onPress={onCheckIn} style={{ marginBottom: 16 }}>
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 17 }}>😊 I'm doing fine — check in</Text>
      </Btn>

      <Card><SunArc medicines={data.medicines} /></Card>
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
        <Card style={{ flex: 1 }}>
          <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 4 }}>Medicines on track</Text>
          <Text style={{ fontSize: 24, fontWeight: '800', color: adherePct === 100 ? colors.emerald : adherePct >= 67 ? colors.amber : colors.rose }}>{adherePct}%</Text>
        </Card>
        <Card style={{ flex: 1 }}>
          <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 4 }}>Medicines taken</Text>
          <Text style={{ fontSize: 24, fontWeight: '800', color: colors.ink }}>{takenToday}/{data.medicines.length}</Text>
        </Card>
      </View>

      <Card>
        <TouchableOpacity onPress={() => navigation.navigate('Account', { screen: 'Reports' })} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 }}>
          <Text style={{ fontSize: 28 }}>🚶</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, color: colors.muted }}>Steps today {tracking && <Text style={{ color: colors.emerald, fontWeight: '700' }}>· LIVE</Text>}</Text>
            <Text style={{ fontSize: 19, fontWeight: '800', color: colors.ink }}>{todaySteps.toLocaleString()} <Text style={{ fontSize: 13, fontWeight: '400', color: colors.muted }}>/ {STEP_GOAL.toLocaleString()}</Text></Text>
          </View>
          <ChevronRight size={20} color={colors.muted} />
        </TouchableOpacity>
        <TouchableOpacity onPress={toggleTracking} style={{ marginTop: 10, padding: 12, minHeight: 46, borderRadius: 10, backgroundColor: tracking ? 'rgba(229,62,90,.1)' : colors.primarySoft, borderWidth: 1, borderColor: tracking ? 'rgba(229,62,90,.3)' : 'rgba(61,122,92,.3)', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: tracking ? colors.rose : colors.primary, fontWeight: '700', fontSize: 14 }}>{tracking ? '⏹ Stop tracking' : '▶️ Start tracking my walk'}</Text>
        </TouchableOpacity>
      </Card>

      {nextMed ? (
        <Card style={{ borderLeftWidth: 4, borderLeftColor: colors.amber }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, color: colors.amber, fontWeight: '700', marginBottom: 2 }}>NEXT MEDICINE</Text>
              <Text style={{ fontWeight: '700', fontSize: 17, color: colors.ink }}>{medicineFormIcon(nextMed.form)} {nextMed.name} · {nextMed.dosage}</Text>
              <Text style={{ fontSize: 14, color: colors.muted }}>⏰ {fmtTime(nextMed.time)}</Text>
            </View>
            <TouchableOpacity onPress={() => onMarkTaken(nextMed)} style={{ backgroundColor: colors.emerald, borderRadius: 99, width: 52, height: 52, alignItems: 'center', justifyContent: 'center' }}>
              <Check size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Btn size="sm" variant="outline" onPress={() => onSkip(nextMed)} style={{ flex: 1 }}>⏭ Skip</Btn>
            <Btn size="sm" variant="outline" onPress={() => onPostpone(nextMed)} style={{ flex: 1 }}>⏰ Snooze</Btn>
          </View>
        </Card>
      ) : (
        <Card style={{ backgroundColor: 'rgba(5,150,105,.08)', borderColor: 'rgba(5,150,105,.3)' }}>
          <Text style={{ color: colors.emerald, fontWeight: '600', fontSize: 16 }}>🎉 All medicines taken today!</Text>
        </Card>
      )}

      <Text style={{ fontWeight: '800', fontSize: 16, color: colors.amber, marginBottom: 10 }}>Quick actions</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {[
          { k: 'Medicines', l: 'Medicines', e: '💊' },
          { k: 'Reminders', l: 'Reminders', e: '🔔' },
          { k: 'Contacts', l: 'Contacts', e: '📞' },
        ].map(q => (
          <TouchableOpacity key={q.k} onPress={() => navigation.navigate(q.k)}
            style={{ flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingVertical: 16, minHeight: 76, alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Text style={{ fontSize: 26 }}>{q.e}</Text>
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.ink }}>{q.l}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </>
  );
}

const ACTIVITY_ICONS = { checkin: '😊', medicine: '💊', emergency: '🆘', bill: '📄', water: '💧', steps: '🚶', contact: '📇', circle: '🔵', reminder: '⭐' };

const SUMMARY_SEVERITY_STYLE = [
  { bg: 'rgba(255,77,106,.12)', border: 'rgba(255,77,106,.35)' },
  { bg: 'rgba(245,158,11,.12)', border: 'rgba(245,158,11,.35)' },
  { bg: 'rgba(59,130,246,.10)', border: 'rgba(59,130,246,.3)' },
  { bg: 'rgba(34,197,94,.10)', border: 'rgba(34,197,94,.3)' },
];

function FamilyView({ data, adherePct, nextMed, todaySteps, digestText, digestLoading, onDigest, navigation }) {
  const { colors } = useTheme();
  const { syncFromBackend } = useData();
  const lastCI = data.activityLog.find(a => a.type === 'checkin');
  const td = new Date().toDateString();

  // Today's Family Summary — a caregiver managing several Care Circles
  // (e.g. "Parents Care," "Pregnancy Care," "Child Care") should see
  // what's happening across ALL of them the moment the app opens, not
  // just whichever circle happens to be active. Best-effort/non-blocking:
  // if this fails (offline, etc.) the rest of the dashboard still renders.
  const [summary, setSummary] = useState([]);
  const [summaryLoading, setSummaryLoading] = useState(true);
  useEffect(() => {
    getCareTimeline().then(setSummary).catch(() => {}).finally(() => setSummaryLoading(false));
  }, []);

  // Dismissible for the day — closing it hides it until tomorrow, when
  // there's genuinely new information to show, rather than hiding it
  // forever (which would silently bury real alerts on later visits).
  const DISMISS_KEY = 'familySummaryDismissedDate';
  const [summaryDismissed, setSummaryDismissed] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem(DISMISS_KEY).then(saved => {
      if (saved === todayStr()) setSummaryDismissed(true);
    });
  }, []);
  function dismissSummary() {
    setSummaryDismissed(true);
    AsyncStorage.setItem(DISMISS_KEY, todayStr()).catch(() => {});
  }

  // My Care Circles — a quick-switch row right on Home, so a caregiver
  // managing several circles doesn't have to go through Account every
  // time. Deliberately built entirely inside this screen rather than
  // touching anything under the Account tab (CareCirclesScreen.js etc.
  // stay exactly as they were) — this is an additional, independent entry
  // point to the same underlying data.
  const [circles, setCircles] = useState([]);
  const [circlesLoading, setCirclesLoading] = useState(true);
  const [switchingId, setSwitchingId] = useState(null);
  useEffect(() => {
    listCircles().then(list => setCircles((list || []).filter(c => c.status === 'active'))).catch(() => {}).finally(() => setCirclesLoading(false));
  }, []);

  async function handleSetDefault(circle) {
    if (circle.isActive) return;
    setSwitchingId(circle.id);
    try {
      await setActiveCircle(circle.id);
      await syncFromBackend();
      const updated = await listCircles().catch(() => null);
      if (updated) setCircles(updated.filter(c => c.status === 'active'));
    } catch (e) {
      Alert.alert('Couldn\'t switch', 'Please try again.');
    } finally { setSwitchingId(null); }
  }

  return (
    <>
      <Text style={{ fontSize: 24, fontWeight: '800', color: colors.ink, marginBottom: 2 }}>{data.family.seniorName}'s day</Text>
      <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 16 }}>Live family overview — cross-country care dashboard</Text>

      {!circlesLoading && circles.length > 1 && (
        <View style={{ marginBottom: 14 }}>
          <Text style={{ fontWeight: '800', fontSize: 15, color: colors.amber, marginBottom: 10 }}>My Care Circles</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 8 }}>
            {circles.map(c => (
              <TouchableOpacity key={c.id} onPress={() => handleSetDefault(c)} activeOpacity={0.7}
                style={{
                  width: 128, backgroundColor: colors.card, borderRadius: 14, padding: 12,
                  borderWidth: c.isActive ? 2 : 1, borderColor: c.isActive ? colors.primary : colors.border,
                }}>
                <Text style={{ fontSize: 26, marginBottom: 6 }}>{c.icon}</Text>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.ink }} numberOfLines={1}>{c.name}</Text>
                <Text style={{ fontSize: 11, color: colors.muted, marginTop: 1 }}>{c.isOwner ? 'Owner' : c.myRole}</Text>
                {c.isActive ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 8 }}>
                    <Star size={11} color={colors.primary} fill={colors.primary} />
                    <Text style={{ fontSize: 10, fontWeight: '700', color: colors.primary }}>Default</Text>
                  </View>
                ) : (
                  <Text style={{ fontSize: 10, fontWeight: '700', color: colors.muted, marginTop: 8 }}>
                    {switchingId === c.id ? 'Switching…' : 'Tap to set default'}
                  </Text>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {!summaryDismissed && (summaryLoading || summary.length > 0) && (
        <View style={{ marginBottom: 14 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <Text style={{ fontWeight: '800', fontSize: 15, color: colors.amber }}>📋 Today's Family Summary</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              {summary.length > 3 && (
                <TouchableOpacity onPress={() => navigation.navigate('Account', { screen: 'CareTimeline' })}>
                  <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '600' }}>View all →</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={dismissSummary} style={{ padding: 4 }}>
                <X size={16} color={colors.muted} />
              </TouchableOpacity>
            </View>
          </View>
          {summary.slice(0, 3).map(item => {
            const style = SUMMARY_SEVERITY_STYLE[item.severity] || SUMMARY_SEVERITY_STYLE[2];
            return (
              <Card key={item.id} style={{ backgroundColor: style.bg, borderColor: style.border, flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                <Text style={{ fontSize: 16 }}>{item.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: colors.ink }}>{item.text}</Text>
                </View>
              </Card>
            );
          })}
        </View>
      )}

      <Card style={{ backgroundColor: 'rgba(61,122,92,.06)', borderColor: 'rgba(61,122,92,.3)' }}>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ width: 36, height: 36, borderRadius: 99, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
            <Sparkles size={16} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '700', fontSize: 13, color: colors.primary, marginBottom: 4 }}>AI Daily Summary</Text>
            <Text style={{ fontSize: 13, color: digestText ? colors.ink : colors.muted, lineHeight: 19 }}>
              {digestText || `Get a plain-English summary of ${data.family.seniorName.split(' ')[0]}'s day.`}
            </Text>
            <TouchableOpacity onPress={onDigest} disabled={digestLoading} style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <RefreshCw size={13} color={colors.primary} />
              <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 12 }}>{digestLoading ? 'Generating…' : digestText ? 'Refresh summary' : 'Generate summary'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Card>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        <Card style={{ width: '47%' }}><Text style={{ fontSize: 11, color: colors.muted }}>Adherence today</Text><Text style={{ fontSize: 22, fontWeight: '800', color: adherePct === 100 ? colors.emerald : adherePct >= 67 ? colors.amber : colors.rose }}>{adherePct}%</Text></Card>
        <TouchableOpacity style={{ width: '47%' }} onPress={() => navigation.navigate('Account', { screen: 'Reports' })}>
          <Card><Text style={{ fontSize: 11, color: colors.muted }}>🚶 Steps today</Text><Text style={{ fontSize: 22, fontWeight: '800', color: todaySteps >= STEP_GOAL ? colors.emerald : colors.ink }}>{todaySteps.toLocaleString()}</Text></Card>
        </TouchableOpacity>
        <Card style={{ width: '47%' }}><Text style={{ fontSize: 11, color: colors.muted }}>Last check-in</Text><Text style={{ fontSize: 16, fontWeight: '700', color: colors.ink }}>{lastCI ? timeAgo(lastCI.ts) : '—'}</Text></Card>
        <Card style={{ width: '47%' }}><Text style={{ fontSize: 11, color: colors.muted }}>Next medicine</Text><Text style={{ fontSize: 13, fontWeight: '700', color: colors.ink }}>{nextMed ? `${nextMed.name} ${fmtTime(nextMed.time)}` : 'All taken ✓'}</Text></Card>
      </View>

      <Text style={{ fontWeight: '800', fontSize: 17, color: colors.amber, marginBottom: 10 }}>Today's medicines</Text>
      <Card style={{ padding: 0 }}>
        {data.medicines.map((m, i) => {
          const taken = m.lastTakenDate === td;
          const skipped = m.lastSkippedDate === td;
          const now = new Date(), mm = now.getHours() * 60 + now.getMinutes();
          const [mh, min] = (m.time || '').split(':').map(Number);
          const mt = Number.isFinite(mh) ? mh * 60 + min : null;
          const missed = !taken && !skipped && mt !== null && mm > mt + 30;
          const label = taken ? 'Taken ✓' : skipped ? 'Skipped' : missed ? 'Missed' : 'Pending';
          const bg = taken ? 'rgba(5,150,105,.12)' : skipped ? 'rgba(148,163,184,.18)' : missed ? 'rgba(229,62,90,.12)' : 'rgba(245,158,11,.12)';
          const fg = taken ? colors.emerald : skipped ? colors.muted : missed ? colors.rose : colors.amber;
          return (
            <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderBottomWidth: i < data.medicines.length - 1 ? 1 : 0, borderBottomColor: colors.border }}>
              <View>
                <Text style={{ fontWeight: '600', fontSize: 14, color: colors.ink }}>{medicineFormIcon(m.form)} {m.name} <Text style={{ color: colors.muted, fontWeight: '400' }}>· {m.dosage}</Text></Text>
                <Text style={{ fontSize: 12, color: colors.muted }}>⏰ {fmtTime(m.time)}</Text>
              </View>
              <StatusPill label={label} bg={bg} fg={fg} />
            </View>
          );
        })}
      </Card>

      <Text style={{ fontWeight: '800', fontSize: 17, color: colors.amber, marginBottom: 10, marginTop: 20 }}>Activity feed</Text>
      <Card style={{ padding: 0 }}>
        {data.activityLog.slice(0, 8).map((a, i) => (
          <View key={a.id} style={{ flexDirection: 'row', gap: 10, padding: 14, borderBottomWidth: i < Math.min(data.activityLog.length, 8) - 1 ? 1 : 0, borderBottomColor: colors.border }}>
            <View style={{ width: 28, height: 28, borderRadius: 99, backgroundColor: colors.greyLt, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 13 }}>{ACTIVITY_ICONS[a.type] || '🔔'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, color: colors.ink }}>{a.message}</Text>
              <Text style={{ fontSize: 11, color: colors.muted, marginTop: 1 }}>{timeAgo(a.ts)}</Text>
            </View>
          </View>
        ))}
        {data.activityLog.length === 0 && (
          <Text style={{ fontSize: 13, color: colors.muted, padding: 14, textAlign: 'center' }}>No activity yet.</Text>
        )}
      </Card>
    </>
  );
}
