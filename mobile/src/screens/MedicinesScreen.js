import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { Plus, Camera, ChevronRight, Trash2, Sparkles, CheckCircle, AlertCircle, Check } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { useData } from '../context/DataContext';
import { Card, Btn, Input, StatusPill, ChipRow } from '../components/UI';
import { MED_CONDITIONS } from '../theme/theme';
import { MEDICINE_FORMS, medicineFormIcon } from '../utils/medicineForm';
import { scanPrescriptionPhoto, explainMedicine } from '../services/aiService';

function fmtTime(t) {
  if (!t) return 'Not set';
  const [h, m] = t.split(':').map(Number);
  if (Number.isNaN(h)) return 'Not set';
  const ap = h >= 12 ? 'PM' : 'AM', h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ap}`;
}

export default function MedicinesScreen() {
  const { colors } = useTheme();
  const { data, addMedicine, markTaken, skipMedicine, postponeMedicine, deleteMedicine } = useData();
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: '', dosage: '', form: 'tablet', time: '08:00', instructions: '', purpose: '' });
  const [scanning, setScanning] = useState(false);
  const [reviewMeds, setReviewMeds] = useState(null); // array while reviewing scan results
  const [explainFor, setExplainFor] = useState(null); // medicine object while the AI Info sheet is open
  const [explainText, setExplainText] = useState('');
  const [explainLoading, setExplainLoading] = useState(false);
  const td = new Date().toDateString();

  function submitAdd() {
    if (!form.name.trim() || !form.time) return;
    addMedicine(form);
    setForm({ name: '', dosage: '', form: 'tablet', time: '08:00', instructions: '', purpose: '' });
    setAddOpen(false);
  }

  function handlePostpone(med) {
    Alert.alert('Postpone reminder', `Remind again for ${med.name} in how long?`, [
      { text: '15 minutes', onPress: () => postponeMedicine(med, 15) },
      { text: '30 minutes', onPress: () => postponeMedicine(med, 30) },
      { text: '1 hour', onPress: () => postponeMedicine(med, 60) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  async function openExplain(med) {
    setExplainFor(med);
    setExplainText('');
    setExplainLoading(true);
    try {
      const t = await explainMedicine(med.name, med.dosage, med.purpose);
      setExplainText(t);
    } finally { setExplainLoading(false); }
  }

  async function scanPrescription() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert('Camera permission needed', 'Enable camera access in Settings to scan a prescription.'); return; }
    const result = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.7, allowsEditing: true });
    if (result.canceled) return;
    const asset = result.assets[0];
    setScanning(true);
    try {
      const base64 = asset.base64 || await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
      const meds = await scanPrescriptionPhoto(base64, 'image/jpeg');
      if (!meds.length) { Alert.alert('No medicines found', 'Please try a clearer photo of the prescription.'); return; }
      setReviewMeds(meds.map((m, i) => ({ ...m, _id: `rx-${i}`, _confirmed: false })));
    } catch (e) {
      Alert.alert('Scan failed', "Couldn't read the prescription. Please try again with a clearer photo.");
    } finally { setScanning(false); }
  }

  function toggleConfirm(id) {
    setReviewMeds(prev => prev.map(m => m._id === id ? { ...m, _confirmed: !m._confirmed } : m));
  }
  function updateReviewMed(id, field, val) {
    setReviewMeds(prev => prev.map(m => m._id === id ? { ...m, [field]: val } : m));
  }
  function addConfirmed() {
    const confirmed = reviewMeds.filter(m => m._confirmed);
    if (!confirmed.length) { Alert.alert('Nothing confirmed', 'Please confirm at least one medicine before adding.'); return; }
    confirmed.forEach(m => {
      addMedicine({
        name: m.name, dosage: m.dosage, time: m.times?.[0] || '08:00',
        instructions: m.withFood === 'yes' ? 'With food' : m.withFood === 'no' ? 'Without food' : '',
        purpose: m.condition || m.purpose,
      });
    });
    setReviewMeds(null);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView style={{ flex: 1, padding: 16 }} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Text style={{ fontWeight: '800', fontSize: 20, color: colors.ink }}>Medicines</Text>
          <TouchableOpacity onPress={() => setAddOpen(v => !v)}><Plus size={24} color={colors.primary} /></TouchableOpacity>
        </View>

        {/* Prominent AI scanner CTA */}
        <TouchableOpacity onPress={scanPrescription} disabled={scanning}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 16, backgroundColor: colors.primarySoft, borderWidth: 1.5, borderColor: colors.border, borderStyle: 'dashed', marginBottom: 14 }}>
          <View style={{ width: 46, height: 46, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
            {scanning ? <ActivityIndicator color="#fff" size="small" /> : <Camera size={22} color="#fff" />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '800', fontSize: 15, color: colors.ink }}>📷 Scan a Prescription with AI</Text>
            <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>{scanning ? 'Reading your prescription…' : 'AI reads medicine names, dosage, and timing automatically'}</Text>
          </View>
          {!scanning && <ChevronRight size={18} color={colors.primary} />}
        </TouchableOpacity>

        {addOpen && (
          <Card>
            <Input label="Medicine name" value={form.name} onChangeText={t => setForm(f => ({ ...f, name: t }))} placeholder="e.g. Paracetamol" />
            <Input label="Dosage" value={form.dosage} onChangeText={t => setForm(f => ({ ...f, dosage: t }))} placeholder="e.g. 500mg" />
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.muted, marginBottom: 6 }}>Medicine form</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
              {MEDICINE_FORMS.map(f => (
                <TouchableOpacity key={f.value} onPress={() => setForm(prev => ({ ...prev, form: f.value }))}
                  style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1.5, borderColor: form.form === f.value ? colors.primary : colors.border, backgroundColor: form.form === f.value ? colors.primarySoft : colors.cardAlt }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: form.form === f.value ? colors.primary : colors.muted }}>{f.icon} {f.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Input label="Time (HH:MM 24h)" value={form.time} onChangeText={t => setForm(f => ({ ...f, time: t }))} placeholder="08:00" />
            <Input label="Instructions" value={form.instructions} onChangeText={t => setForm(f => ({ ...f, instructions: t }))} placeholder="e.g. With breakfast" />
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.muted, marginBottom: 6 }}>What is this medicine for?</Text>
            <ChipRow options={MED_CONDITIONS} selected={form.purpose} onSelect={c => setForm(f => ({ ...f, purpose: c }))} />
            <View style={{ height: 12 }} />
            <Btn full onPress={submitAdd}>Add Medicine</Btn>
          </Card>
        )}

        {data.medicines.map(m => {
          const taken = m.lastTakenDate === td;
          const skipped = m.lastSkippedDate === td;
          const isDone = taken || skipped;
          return (
            <Card key={m.id}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '700', fontSize: 15, color: colors.ink }}>{medicineFormIcon(m.form)} {m.name} <Text style={{ color: colors.muted, fontWeight: '400' }}>· {m.dosage}</Text></Text>
                  <Text style={{ fontSize: 12, color: colors.muted, marginTop: 3 }}>🕐 {fmtTime(m.time)}</Text>
                  {m.instructions ? <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>💡 {m.instructions}</Text> : null}
                  {m.purpose ? <Text style={{ fontSize: 12, color: colors.ink, backgroundColor: colors.cardAlt, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, marginTop: 6, alignSelf: 'flex-start' }}>💊 {m.purpose}</Text> : null}
                  {m.stock <= 10 ? <Text style={{ fontSize: 11, color: colors.rose, fontWeight: '600', marginTop: 6 }}>⚠️ Low stock: {m.stock} left</Text> : null}
                </View>
                <StatusPill label={taken ? 'Taken ✓' : skipped ? 'Skipped' : 'Pending'}
                  bg={taken ? 'rgba(5,150,105,.12)' : skipped ? 'rgba(148,163,184,.18)' : 'rgba(245,158,11,.12)'}
                  fg={taken ? colors.emerald : skipped ? colors.muted : colors.amber} />
              </View>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                {!isDone && <Btn size="sm" variant="outline" onPress={() => skipMedicine(m)}>⏭ Skip</Btn>}
                {!isDone && <Btn size="sm" variant="outline" onPress={() => handlePostpone(m)}>⏰ Snooze</Btn>}
                {!isDone && <Btn size="sm" onPress={() => markTaken(m)}>✓ Take</Btn>}
                <TouchableOpacity onPress={() => openExplain(m)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 10 }}>
                  <Sparkles size={13} color={colors.primary} />
                  <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600' }}>AI Info</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => deleteMedicine(m.id)} style={{ marginLeft: 'auto', padding: 6 }}>
                  <Trash2 size={16} color={colors.grey} />
                </TouchableOpacity>
              </View>
            </Card>
          );
        })}
      </ScrollView>

      {/* AI Info modal */}
      <Modal visible={!!explainFor} animationType="slide" transparent onRequestClose={() => setExplainFor(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(13,27,62,0.6)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '70%' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Sparkles size={18} color={colors.primary} />
              <Text style={{ fontWeight: '800', fontSize: 16, color: colors.ink, flex: 1 }}>{explainFor?.name} {explainFor?.dosage}</Text>
            </View>
            {explainLoading ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }} />
            ) : (
              <ScrollView>
                <Text style={{ fontSize: 14, color: colors.ink, lineHeight: 21 }}>{explainText}</Text>
              </ScrollView>
            )}
            <Btn full style={{ marginTop: 16 }} onPress={() => setExplainFor(null)}>Close</Btn>
          </View>
        </View>
      </Modal>

      {/* Prescription review modal */}
      <Modal visible={!!reviewMeds} animationType="slide" onRequestClose={() => setReviewMeds(null)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
          <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Sparkles size={20} color={colors.primary} />
            <Text style={{ fontWeight: '800', fontSize: 16, color: colors.ink }}>Verify medicines from prescription</Text>
          </View>
          <View style={{ backgroundColor: 'rgba(245,158,11,.10)', borderWidth: 1, borderColor: 'rgba(245,158,11,.3)', margin: 16, padding: 12, borderRadius: 10, flexDirection: 'row', gap: 8 }}>
            <AlertCircle size={16} color={colors.amber} />
            <Text style={{ fontSize: 12, color: colors.ink, flex: 1 }}>Cross-check each medicine against the label on the bottle from the pharmacy before confirming.</Text>
          </View>
          <ScrollView style={{ flex: 1, paddingHorizontal: 16 }}>
            {(reviewMeds || []).map(m => (
              <Card key={m._id} style={{ borderWidth: 2, borderColor: m._confirmed ? colors.primary : colors.border }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '700', fontSize: 15, color: colors.ink }}>{m.name}</Text>
                    <Text style={{ fontSize: 12, color: colors.muted }}>{m.frequency} · Qty: {m.qty || '—'}</Text>
                  </View>
                  <TouchableOpacity onPress={() => toggleConfirm(m._id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 2, borderColor: m._confirmed ? colors.primary : colors.border, backgroundColor: m._confirmed ? colors.primary : 'transparent' }}>
                    {m._confirmed ? <CheckCircle size={14} color="#fff" /> : <Check size={14} color={colors.muted} />}
                    <Text style={{ fontSize: 12, fontWeight: '700', color: m._confirmed ? '#fff' : colors.muted }}>{m._confirmed ? 'Confirmed' : 'Confirm'}</Text>
                  </TouchableOpacity>
                </View>
                <Input label="Dosage" value={m.dosage} onChangeText={v => updateReviewMed(m._id, 'dosage', v)} />
                <Text style={{ fontSize: 12, color: colors.ink, backgroundColor: colors.primarySoft, borderRadius: 10, padding: 10, marginTop: 4 }}>💊 {m.purpose || 'No explanation available.'}</Text>
              </Card>
            ))}
          </ScrollView>
          <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: colors.border, flexDirection: 'row', gap: 8 }}>
            <Btn full variant="outline" onPress={() => setReviewMeds(null)}>Cancel</Btn>
            <Btn full onPress={addConfirmed}>Add Confirmed</Btn>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
