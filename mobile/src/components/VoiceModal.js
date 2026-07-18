import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { Mic, MicOff, Languages, Sparkles, X, Send, Volume2 } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { useData, todayStr } from '../context/DataContext';
import {
  VOICE_LANGS, matchVoiceKeyword, findMedicineInText,
  initVoice, startVoiceRecognition, stopVoiceRecognition, destroyVoice, isVoiceAvailable,
} from '../services/voiceService';
import { speak, stopSpeaking } from '../services/speechService';
import { getPrompts, matchActionWordLocalized } from '../i18n/voicePrompts';
import { interpretVoiceCommand } from '../services/aiService';
import { Btn } from './UI';

// Matches a spoken/typed medicine name against the household's medicine
// list — tries an exact (case-insensitive) match first, then falls back to
// "did they say a word that's contained in / contains a medicine name" so
// "amlodipine five mg" still matches a medicine named "Amlodipine". Medicine
// names themselves aren't translated (they're proper nouns/brand names), so
// this matcher is language-independent by design.
function matchMedicineByName(text, medicines) {
  const t = text.toLowerCase().trim();
  const exact = medicines.find(m => m.name.toLowerCase() === t);
  if (exact) return exact;
  return medicines.find(m => t.includes(m.name.toLowerCase()) || m.name.toLowerCase().includes(t));
}

export default function VoiceModal({ visible, onClose }) {
  const { colors } = useTheme();
  const { data, markTaken, skipMedicine, postponeMedicine, checkIn, logWater, logSteps, addLog, addReminder } = useData();

  const [mode, setMode] = useState('guided'); // guided | freeform
  const [lang, setLang] = useState('en-US');
  const t = getPrompts(lang); // current language's translated prompt set — falls back to English field-by-field
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [supported, setSupported] = useState(true);
  const initedRef = useRef(false);

  // ---- guided flow state ----
  // step: 'start' | 'asking_medicine' | 'asking_action' | 'asking_duration' | 'done'
  const [step, setStep] = useState('start');
  const [prompt, setPrompt] = useState('');
  const [speaking, setSpeaking] = useState(false);
  const [selectedMed, setSelectedMed] = useState(null);
  const [guidedResult, setGuidedResult] = useState(null);

  // ---- freeform flow state (unchanged behaviour, kept as an option) ----
  const [useAI, setUseAI] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [freeformResult, setFreeformResult] = useState(null);
  const [manualText, setManualText] = useState('');

  useEffect(() => {
    if (!visible) return;
    (async () => {
      const avail = await isVoiceAvailable().catch(() => false);
      setSupported(avail);
      if (!initedRef.current) {
        initVoice({
          onStart: () => setListening(true),
          onEnd: () => setListening(false),
          onResult: (text, partial) => { setTranscript(text); if (!partial) handleFinalTranscript(text); },
          onError: () => setListening(false),
        });
        initedRef.current = true;
      }
    })();
    return () => { stopVoiceRecognition().catch(() => {}); stopSpeaking(); };
  }, [visible]);

  useEffect(() => () => { if (initedRef.current) destroyVoice().catch(() => {}); }, []);

  // Reset the guided flow back to the start each time the modal is reopened.
  useEffect(() => {
    if (visible) {
      setStep('start'); setSelectedMed(null); setGuidedResult(null); setTranscript('');
      setFreeformResult(null);
    }
  }, [visible]);

  function say(text, onDone) {
    setSpeaking(true);
    setPrompt(text);
    speak(text, lang, () => { setSpeaking(false); onDone && onDone(); });
  }

  async function listenNow() {
    setTranscript('');
    try { await startVoiceRecognition(lang); } catch (e) { setSupported(false); }
  }

  // ---- guided flow ----
  function startGuidedFlow() {
    setGuidedResult(null);
    setStep('asking_medicine');
    const pending = data.medicines.filter(m => m.lastTakenDate !== todayStr() && m.lastSkippedDate !== todayStr());
    const list = (pending.length ? pending : data.medicines).map(m => m.name).join(', ');
    say(t.askMedicine(list), () => {
      if (supported) listenNow();
    });
  }

  function handleMedicineAnswer(text) {
    const med = matchMedicineByName(text, data.medicines);
    if (!med) {
      say(t.retryMedicine, () => { if (supported) listenNow(); });
      return;
    }
    setSelectedMed(med);
    setStep('asking_action');
    say(t.gotItAskAction(med.name), () => {
      if (supported) listenNow();
    });
  }

  function handleActionAnswer(text) {
    const action = matchActionWordLocalized(text, lang);
    if (!action) {
      say(t.retryAction, () => { if (supported) listenNow(); });
      return;
    }
    runGuidedAction(action);
  }

  function runGuidedAction(action) {
    if (!selectedMed) return;
    if (action === 'take') {
      markTaken(selectedMed);
      finishGuided(t.tookConfirm(selectedMed.name));
    } else if (action === 'skip') {
      skipMedicine(selectedMed);
      finishGuided(t.skippedConfirm(selectedMed.name));
    } else if (action === 'postpone') {
      setStep('asking_duration');
      say(t.askDuration);
    }
  }

  function runPostpone(minutes) {
    postponeMedicine(selectedMed, minutes);
    finishGuided(t.postponedConfirm(selectedMed.name, minutes));
  }

  function finishGuided(message) {
    stopVoiceRecognition().catch(() => {});
    setStep('done');
    setGuidedResult({ ok: true, message });
    say(message);
  }

  function restartGuided() {
    setSelectedMed(null);
    startGuidedFlow();
  }

  // ---- shared transcript router ----
  function handleFinalTranscript(text) {
    if (!text || !text.trim()) return;
    if (mode === 'guided') {
      if (step === 'asking_medicine') handleMedicineAnswer(text.trim());
      else if (step === 'asking_action') handleActionAnswer(text.trim());
    } else {
      processFreeform(text.trim());
    }
  }

  // ---- freeform flow (original behaviour, now also supports "remind me to…") ----
  async function processFreeform(text) {
    setProcessing(true); setFreeformResult(null);
    try {
      if (useAI) {
        const meds = data.medicines.map(m => `${m.name} (${m.dosage}, scheduled ${m.time}, ${m.lastTakenDate === todayStr() ? 'already taken today' : 'not yet taken today'})`);
        const parsed = await interpretVoiceCommand(text, meds).catch(() => ({ action: 'unknown', reply: '' }));
        applyFreeformAction(parsed, text);
      } else {
        const kw = matchVoiceKeyword(text);
        const med = findMedicineInText(text, data.medicines);
        if (kw === 'taken' || med) applyFreeformAction({ action: 'mark_taken', medicineName: med?.name || '' }, text);
        else if (kw === 'checkin') applyFreeformAction({ action: 'checkin' }, text);
        else if (kw === 'water') applyFreeformAction({ action: 'water' }, text);
        else if (kw === 'walk') applyFreeformAction({ action: 'walk' }, text);
        else setFreeformResult({ ok: false, message: 'Didn\'t recognize that. Try saying "I took my medicine" — or turn on AI understanding to also create reminders by voice, in any language.' });
      }
    } finally { setProcessing(false); }
  }

  function applyFreeformAction(parsed, rawText) {
    const { action, medicineName, reminderTitle, reminderType, reminderFreq, reply: aiReply } = parsed;
    if (action === 'mark_taken') {
      const pending = data.medicines.filter(m => m.lastTakenDate !== todayStr());
      let target = medicineName ? data.medicines.find(m => m.name.toLowerCase() === String(medicineName).toLowerCase()) : null;
      if (!target && pending.length === 1) target = pending[0];
      if (target) {
        markTaken(target);
        setFreeformResult({ ok: true, message: aiReply || `✅ Marked ${target.name} as taken. Well done!` });
      } else if (pending.length > 1) {
        setFreeformResult({ ok: false, message: `You have ${pending.length} medicines pending — please say the medicine name, e.g. "I took my ${pending[0].name}".` });
      } else {
        setFreeformResult({ ok: false, message: "Couldn't find that medicine on your list." });
      }
    } else if (action === 'checkin') {
      checkIn();
      setFreeformResult({ ok: true, message: aiReply || '✅ Check-in recorded — glad you\'re doing well!' });
    } else if (action === 'water') {
      logWater();
      setFreeformResult({ ok: true, message: aiReply || '✅ Logged a glass of water. Stay hydrated!' });
    } else if (action === 'walk') {
      logSteps(500);
      addLog('steps', 'Logged 500 steps via voice');
      setFreeformResult({ ok: true, message: aiReply || '✅ Logged 500 steps from your walk. Keep it up!' });
    } else if (action === 'create_reminder') {
      const title = (reminderTitle || rawText).trim();
      const type = ['water', 'exercise', 'medicine', 'custom'].includes(reminderType) ? reminderType : 'custom';
      addReminder({ title, type, freq: reminderFreq || '' });
      setFreeformResult({ ok: true, message: aiReply || `✅ Reminder created: "${title}"${reminderFreq ? ` — ${reminderFreq}` : ''}.` });
    } else {
      setFreeformResult({ ok: false, message: aiReply || `Heard: "${rawText}" — didn't catch a clear action. Try "I took my medicine" or "remind me to…".` });
    }
  }

  function submitManual() {
    if (!manualText.trim()) return;
    processFreeform(manualText.trim());
    setManualText('');
  }

  function toggleListen() {
    if (listening) { stopVoiceRecognition(); return; }
    listenNow();
  }

  const pendingMeds = data.medicines.filter(m => m.lastTakenDate !== todayStr() && m.lastSkippedDate !== todayStr());

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(13,27,62,0.6)', justifyContent: 'center', padding: 16 }}>
        <View style={{ backgroundColor: colors.card, borderRadius: 24, padding: 24, maxHeight: '88%' }}>
          <TouchableOpacity
            onPress={() => { stopSpeaking(); stopVoiceRecognition().catch(() => {}); onClose(); }}
            style={{ position: 'absolute', top: 16, right: 16, zIndex: 1, width: 32, height: 32, borderRadius: 99, backgroundColor: colors.cardAlt, alignItems: 'center', justifyContent: 'center' }}
          >
            <X size={18} color={colors.muted} />
          </TouchableOpacity>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={{ alignItems: 'center', marginBottom: 14 }}>
              <View style={{ width: 56, height: 56, borderRadius: 99, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                <Mic size={26} color={colors.primary} />
              </View>
              <Text style={{ fontWeight: '800', fontSize: 18, color: colors.ink }}>Voice Assistant</Text>
              <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2, textAlign: 'center' }}>
                {mode === 'guided' ? t.subtitleGuided : t.subtitleFreeform}
              </Text>
              {mode === 'freeform' && useAI && (
                <Text style={{ fontSize: 11, color: colors.primary, marginTop: 4, textAlign: 'center', fontStyle: 'italic' }}>
                  💡 Also works for "remind me to…" — in any language
                </Text>
              )}
            </View>

            {/* Mode + language pickers — hidden once a guided conversation is underway to reduce clutter */}
            {(mode === 'freeform' || step === 'start') && (
              <>
                <View style={{ flexDirection: 'row', backgroundColor: colors.cardAlt, borderRadius: 12, padding: 3, marginBottom: 14 }}>
                  {[['guided', '🗣 Guided'], ['freeform', '💬 Free-form']].map(([k, l]) => (
                    <TouchableOpacity key={k} onPress={() => { setMode(k); setStep('start'); stopSpeaking(); }} style={{ flex: 1, paddingVertical: 8, borderRadius: 10, backgroundColor: mode === k ? colors.card : 'transparent', alignItems: 'center' }}>
                      <Text style={{ fontWeight: '700', fontSize: 12, color: mode === k ? colors.primary : colors.muted }}>{l}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={{ marginBottom: 14 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                    <Languages size={13} color={colors.muted} />
                    <Text style={{ fontSize: 11, fontWeight: '700', color: colors.muted }}>LANGUAGE</Text>
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {VOICE_LANGS.map(l => (
                      <TouchableOpacity key={l.code} disabled={listening || speaking} onPress={() => setLang(l.code)}
                        style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1.5, borderColor: lang === l.code ? colors.primary : colors.border, backgroundColor: lang === l.code ? colors.primarySoft : colors.cardAlt }}>
                        <Text style={{ fontSize: 12, fontWeight: '600', color: lang === l.code ? colors.primary : colors.muted }}>{l.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </>
            )}

            {!supported && (
              <View style={{ backgroundColor: 'rgba(245,158,11,.10)', borderWidth: 1, borderColor: 'rgba(245,158,11,.3)', borderRadius: 10, padding: 12, marginBottom: 14 }}>
                <Text style={{ fontSize: 12, color: colors.amber }}>🎤 Voice recognition isn't available on this device — use the buttons/text below instead.</Text>
              </View>
            )}

            {/* ============ GUIDED MODE ============ */}
            {mode === 'guided' && (
              <>
                {step === 'start' && (
                  <Btn full onPress={startGuidedFlow} style={{ marginBottom: 8 }}>
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>{t.start}</Text>
                  </Btn>
                )}

                {step !== 'start' && (
                  <>
                    {/* Spoken prompt, shown as text too for anyone who can't hear it */}
                    <View style={{ backgroundColor: colors.primarySoft, borderRadius: 14, padding: 14, marginBottom: 14, flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                      <Volume2 size={18} color={colors.primary} style={{ marginTop: 1 }} />
                      <Text style={{ flex: 1, fontSize: 14, color: colors.ink, fontWeight: '600' }}>{speaking ? prompt : prompt}</Text>
                    </View>

                    {supported && step !== 'done' && (
                      <View style={{ alignItems: 'center', marginBottom: 16 }}>
                        <TouchableOpacity onPress={toggleListen} disabled={speaking} activeOpacity={0.85}
                          style={{ width: 76, height: 76, borderRadius: 99, backgroundColor: listening ? colors.rose : colors.btnFill, alignItems: 'center', justifyContent: 'center', opacity: speaking ? 0.5 : 1 }}>
                          {listening ? <MicOff size={28} color="#fff" /> : <Mic size={28} color="#fff" />}
                        </TouchableOpacity>
                        <Text style={{ fontSize: 12, color: colors.muted, marginTop: 8 }}>
                          {speaking ? t.speaking : listening ? t.listening : t.tapToAnswer}
                        </Text>
                      </View>
                    )}

                    {transcript && step !== 'done' ? (
                      <View style={{ backgroundColor: colors.cardAlt, borderRadius: 12, padding: 12, marginBottom: 12 }}>
                        <Text style={{ fontSize: 13, color: colors.ink, fontStyle: 'italic' }}>{t.youSaid} "{transcript}"</Text>
                      </View>
                    ) : null}

                    {/* Step-specific tap fallbacks — always available, voice optional */}
                    {step === 'asking_medicine' && (
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                        {(pendingMeds.length ? pendingMeds : data.medicines).map(m => (
                          <TouchableOpacity key={m.id} onPress={() => handleMedicineAnswer(m.name)}
                            style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.cardAlt }}>
                            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.ink }}>{m.name}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}

                    {step === 'asking_action' && (
                      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                        <Btn size="sm" variant="outline" onPress={() => runGuidedAction('skip')} style={{ flex: 1 }}>⏭ Skip</Btn>
                        <Btn size="sm" variant="outline" onPress={() => runGuidedAction('postpone')} style={{ flex: 1 }}>⏰ Postpone</Btn>
                        <Btn size="sm" onPress={() => runGuidedAction('take')} style={{ flex: 1 }}>✅ Took it</Btn>
                      </View>
                    )}

                    {step === 'asking_duration' && (
                      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                        <Btn size="sm" variant="outline" onPress={() => runPostpone(15)} style={{ flex: 1 }}>15 min</Btn>
                        <Btn size="sm" variant="outline" onPress={() => runPostpone(30)} style={{ flex: 1 }}>30 min</Btn>
                        <Btn size="sm" variant="outline" onPress={() => runPostpone(60)} style={{ flex: 1 }}>1 hour</Btn>
                      </View>
                    )}

                    {step === 'done' && guidedResult && (
                      <View style={{ backgroundColor: 'rgba(34,197,94,.10)', borderWidth: 1, borderColor: 'rgba(34,197,94,.3)', borderRadius: 12, padding: 14, marginBottom: 14 }}>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: colors.emerald }}>{guidedResult.message}</Text>
                      </View>
                    )}

                    {step === 'done' && (
                      <Btn full variant="outline" onPress={restartGuided} style={{ marginBottom: 8 }}>{t.anotherMedicine}</Btn>
                    )}
                  </>
                )}
              </>
            )}

            {/* ============ FREE-FORM MODE (original behaviour) ============ */}
            {mode === 'freeform' && (
              <>
                <TouchableOpacity onPress={() => setUseAI(v => !v)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, backgroundColor: colors.cardAlt, borderRadius: 12, marginBottom: 16 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Sparkles size={15} color={colors.primary} />
                    <Text style={{ fontSize: 12, color: colors.ink }}>Use AI to understand phrasing</Text>
                  </View>
                  <View style={{ width: 40, height: 22, borderRadius: 99, backgroundColor: useAI ? colors.primary : colors.border, padding: 2, justifyContent: 'center' }}>
                    <View style={{ width: 18, height: 18, borderRadius: 99, backgroundColor: '#fff', transform: [{ translateX: useAI ? 18 : 0 }] }} />
                  </View>
                </TouchableOpacity>

                {supported && (
                  <View style={{ alignItems: 'center', marginBottom: 16 }}>
                    <TouchableOpacity onPress={toggleListen} activeOpacity={0.85}
                      style={{ width: 84, height: 84, borderRadius: 99, backgroundColor: listening ? colors.rose : colors.btnFill, alignItems: 'center', justifyContent: 'center' }}>
                      {listening ? <MicOff size={32} color="#fff" /> : <Mic size={32} color="#fff" />}
                    </TouchableOpacity>
                    <Text style={{ fontSize: 12, color: colors.muted, marginTop: 8 }}>{listening ? 'Listening… tap to stop' : 'Tap to speak'}</Text>
                  </View>
                )}

                {transcript ? (
                  <View style={{ backgroundColor: colors.cardAlt, borderRadius: 12, padding: 14, marginBottom: 12 }}>
                    <Text style={{ fontSize: 13, color: colors.ink, fontStyle: 'italic' }}>"{transcript}"</Text>
                  </View>
                ) : null}

                {processing && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12 }}>
                    <ActivityIndicator color={colors.primary} size="small" />
                    <Text style={{ fontSize: 13, color: colors.muted }}>Understanding...</Text>
                  </View>
                )}

                {freeformResult && (
                  <View style={{ backgroundColor: freeformResult.ok ? 'rgba(34,197,94,.10)' : 'rgba(245,158,11,.10)', borderWidth: 1, borderColor: freeformResult.ok ? 'rgba(34,197,94,.3)' : 'rgba(245,158,11,.3)', borderRadius: 12, padding: 14, marginBottom: 12 }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: freeformResult.ok ? colors.emerald : colors.amber }}>{freeformResult.message}</Text>
                  </View>
                )}

                <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 14 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: colors.muted, marginBottom: 6 }}>OR TYPE WHAT YOU'D SAY</Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TextInput value={manualText} onChangeText={setManualText} onSubmitEditing={submitManual} placeholder="e.g. I took my Metformin" placeholderTextColor={colors.muted}
                      style={{ flex: 1, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.cardAlt, color: colors.ink, fontSize: 13 }} />
                    <TouchableOpacity onPress={submitManual} style={{ backgroundColor: colors.btnFill, borderRadius: 10, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' }}>
                      <Send size={16} color="#fff" />
                    </TouchableOpacity>
                  </View>
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
