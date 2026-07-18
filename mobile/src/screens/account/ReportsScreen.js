import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Sparkles } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { useData } from '../../context/DataContext';
import { Card, StatusPill } from '../../components/UI';
import { StepRing, BarChart } from '../../components/Visuals';
import { STEP_GOAL } from '../../theme/theme';
import { useStepTracking } from '../../hooks/useStepTracking';
import { generateDailyDigest } from '../../services/aiService';

function stepsToKm(s) { return (s * 0.00075).toFixed(2); }
function stepsToCalories(s) { return Math.round(s * 0.04); }
function stepsToActiveMin(s) { return Math.round(s / 100); }

export default function ReportsScreen({ navigation }) {
  const { colors } = useTheme();
  const { data, logSteps } = useData();
  const [tab, setTab] = useState('overview');
  const { tracking, toggleTracking } = useStepTracking(logSteps);
  const [digestLoading, setDigestLoading] = useState(null);
  const [digests, setDigests] = useState({});
  const today = data.reports[0];

  async function generateDigestFor(report) {
    setDigestLoading(report.date);
    try {
      const t = await generateDailyDigest({ date: report.date, adherence: report.adherence, taken: report.taken, total: report.total, waterGlasses: report.waterGlasses, steps: report.steps });
      setDigests(d => ({ ...d, [report.date]: t }));
    } finally { setDigestLoading(null); }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView style={{ flex: 1, padding: 16 }} contentContainerStyle={{ paddingBottom: 40 }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginBottom: 12 }}>
          <Text style={{ color: colors.muted, fontSize: 13 }}>← Account</Text>
        </TouchableOpacity>
        <Text style={{ fontWeight: '800', fontSize: 22, color: colors.ink }}>Health Reports</Text>
        <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 16 }}>Sent daily to family members abroad</Text>

        <View style={{ flexDirection: 'row', backgroundColor: colors.greyLt, borderRadius: 12, padding: 3, marginBottom: 16 }}>
          {[['overview', 'Overview'], ['weekly', '7-Day Trend'], ['history', 'History']].map(([k, l]) => (
            <TouchableOpacity key={k} onPress={() => setTab(k)} style={{ flex: 1, paddingVertical: 7, borderRadius: 10, backgroundColor: tab === k ? colors.card : 'transparent', alignItems: 'center' }}>
              <Text style={{ fontWeight: '600', fontSize: 12, color: tab === k ? colors.primary : colors.muted }}>{l}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {tab === 'overview' && today && (
          <>
            <Card>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 14 }}>
                <StepRing steps={today.steps || 0} />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <Text style={{ fontWeight: '700', fontSize: 14, color: colors.ink }}>🚶 Today's walking</Text>
                    {tracking && <Text style={{ fontSize: 10, fontWeight: '700', color: colors.emerald }}>● LIVE</Text>}
                  </View>
                  <Row label="📍 Distance" value={`${stepsToKm(today.steps || 0)} km`} colors={colors} />
                  <Row label="🔥 Calories" value={`${stepsToCalories(today.steps || 0)} kcal`} colors={colors} />
                  <Row label="⏱ Active time" value={`~${stepsToActiveMin(today.steps || 0)} min`} colors={colors} />
                </View>
              </View>
              <TouchableOpacity onPress={toggleTracking} style={{ padding: 11, borderRadius: 10, backgroundColor: tracking ? 'rgba(229,62,90,.10)' : colors.primarySoft, borderWidth: 1.5, borderColor: tracking ? 'rgba(229,62,90,.35)' : 'rgba(61,122,92,.3)', alignItems: 'center' }}>
                <Text style={{ color: tracking ? colors.rose : colors.primary, fontWeight: '700', fontSize: 13 }}>{tracking ? '⏹ Stop live tracking' : '▶️ Start live tracking'}</Text>
              </TouchableOpacity>
              {tracking && <Text style={{ fontSize: 11, color: colors.muted, marginTop: 8, textAlign: 'center' }}>Keep the phone with you while walking — this uses your device's real step sensor.</Text>}
              <TouchableOpacity onPress={() => logSteps(500)} style={{ marginTop: 8, padding: 9, borderRadius: 10, backgroundColor: colors.greyLt, borderWidth: 1, borderColor: colors.border, alignItems: 'center' }}>
                <Text style={{ color: colors.ink, fontWeight: '600', fontSize: 12 }}>+ Add 500 steps manually</Text>
              </TouchableOpacity>
            </Card>

            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
              <Card style={{ flex: 1 }}><Text style={{ fontSize: 10, color: colors.muted }}>Adherence</Text><Text style={{ fontSize: 20, fontWeight: '800', color: today.adherence === 100 ? colors.emerald : colors.amber }}>{today.adherence}%</Text></Card>
              <Card style={{ flex: 1 }}><Text style={{ fontSize: 10, color: colors.muted }}>Water 💧</Text><Text style={{ fontSize: 20, fontWeight: '800', color: colors.ink }}>{today.waterGlasses}</Text></Card>
              <Card style={{ flex: 1 }}><Text style={{ fontSize: 10, color: colors.muted }}>Check-ins</Text><Text style={{ fontSize: 20, fontWeight: '800', color: colors.ink }}>{today.checkIns}</Text></Card>
            </View>

            <Card style={{ backgroundColor: 'rgba(61,122,92,.06)', borderColor: 'rgba(61,122,92,.2)' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <Sparkles size={14} color={colors.primary} />
                <Text style={{ fontWeight: '700', fontSize: 12, color: colors.primary }}>AI Report Summary</Text>
              </View>
              {digests[today.date] || today.summary ? (
                <Text style={{ fontSize: 13, color: colors.ink, lineHeight: 19 }}>{digests[today.date] || today.summary}</Text>
              ) : (
                <>
                  <Text style={{ fontSize: 13, color: colors.muted }}>Generate a plain-English summary for family members.</Text>
                  <TouchableOpacity onPress={() => generateDigestFor(today)} style={{ marginTop: 8 }}>
                    <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 12 }}>{digestLoading === today.date ? 'Generating…' : '✨ Generate AI summary'}</Text>
                  </TouchableOpacity>
                </>
              )}
            </Card>
          </>
        )}

        {tab === 'weekly' && (
          <>
            <Card>
              <Text style={{ fontWeight: '700', color: colors.ink, marginBottom: 4 }}>7-Day Medicine Adherence</Text>
              <BarChart data={[...data.reports].slice(0, 7).reverse()} valueKey="adherence" maxValue={100}
                colorFn={v => v === 100 ? colors.emerald : v >= 67 ? colors.amber : colors.rose}
                labelFn={d => new Date(d.date + 'T00:00:00').toLocaleDateString('en', { weekday: 'short' })} />
            </Card>
            <Card>
              <Text style={{ fontWeight: '700', color: colors.ink, marginBottom: 4 }}>🚶 7-Day Walking (goal: {STEP_GOAL.toLocaleString()})</Text>
              <BarChart data={[...data.reports].slice(0, 7).reverse()} valueKey="steps" maxValue={Math.max(STEP_GOAL, ...data.reports.map(r => r.steps || 0))}
                colorFn={v => v >= STEP_GOAL ? colors.emerald : v >= STEP_GOAL * 0.5 ? colors.amber : colors.rose}
                labelFn={d => new Date(d.date + 'T00:00:00').toLocaleDateString('en', { weekday: 'short' })} />
            </Card>
          </>
        )}

        {tab === 'history' && data.reports.map(r => (
          <Card key={r.date}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Text style={{ fontWeight: '600', fontSize: 14, color: colors.ink }}>{r.date}</Text>
              <StatusPill label={`${r.adherence}%`} bg={r.adherence === 100 ? 'rgba(5,150,105,.12)' : 'rgba(245,158,11,.12)'} fg={r.adherence === 100 ? colors.emerald : colors.amber} />
            </View>
            <Text style={{ fontSize: 12, color: colors.muted }}>💊 {r.taken}/{r.total} taken · 💧 {r.waterGlasses} glasses · 🚶 {(r.steps || 0).toLocaleString()} steps · 🤝 {r.checkIns} check-ins</Text>
            {(digests[r.date] || r.summary) && <Text style={{ fontSize: 12, color: colors.ink, lineHeight: 18, marginTop: 6, backgroundColor: colors.greyLt, borderRadius: 8, padding: 8 }}>{digests[r.date] || r.summary}</Text>}
          </Card>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value, colors }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
      <Text style={{ fontSize: 12, color: colors.muted }}>{label}</Text>
      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.ink }}>{value}</Text>
    </View>
  );
}
