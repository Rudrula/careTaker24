// ⚠️ TEMPORARILY DISABLED — @react-native-voice/voice was causing the native
// Android/iOS build itself to fail (a separate, later failure than the
// config-plugin issue fixed earlier — that one only affected `expo
// prebuild`; this affects the actual native compile step). Commented out
// rather than removed so it's a two-line change to re-enable once the
// build issue with this package is sorted out:
//   1. Uncomment the import below
//   2. Restore the 5 function bodies below to call the real `Voice` API
//      (see the commented-out originals inline)
// Until then, every function here safely reports "voice isn't available,"
// which VoiceModal.js already handles gracefully — the guided flow's
// tap-to-select chips/buttons and free-form mode's typed-text input both
// keep working normally; only live speech-to-text listening is disabled.
// import Voice from '@react-native-voice/voice';

// Indian regional languages first (this app's core audience — elderly
// parents in India, family abroad), then major international languages.
// Codes are BCP-47 locale tags understood by both the on-device speech
// recognizer and expo-speech's TTS engine. Still exported/used even with
// voice input disabled, since expo-speech (text-to-speech OUTPUT, a
// separate package with no native-build issues) still uses these codes.
export const VOICE_LANGS = [
  { code: 'en-US', label: 'English' },
  { code: 'hi-IN', label: 'हिंदी (Hindi)' },
  { code: 'te-IN', label: 'తెలుగు (Telugu)' },
  { code: 'ta-IN', label: 'தமிழ் (Tamil)' },
  { code: 'kn-IN', label: 'ಕನ್ನಡ (Kannada)' },
  { code: 'ml-IN', label: 'മലയാളം (Malayalam)' },
  { code: 'mr-IN', label: 'मराठी (Marathi)' },
  { code: 'bn-IN', label: 'বাংলা (Bengali)' },
  { code: 'gu-IN', label: 'ગુજરાતી (Gujarati)' },
  { code: 'pa-IN', label: 'ਪੰਜਾਬੀ (Punjabi)' },
  { code: 'ur-IN', label: 'اردو (Urdu)' },
  { code: 'es-ES', label: 'Español (Spanish)' },
  { code: 'fr-FR', label: 'Français (French)' },
  { code: 'ar-SA', label: 'العربية (Arabic)' },
  { code: 'zh-CN', label: '中文 (Chinese)' },
  { code: 'pt-BR', label: 'Português (Portuguese)' },
];

// Offline keyword dictionary — works with zero network/AI calls, mirrors the
// web app's fallback so behaviour is identical when AI understanding is off.
// Coverage is intentionally simple/common phrasing (matches how elderly
// users actually speak) rather than exhaustive — if a phrase isn't
// recognized, "Use AI to understand phrasing" (on by default) handles the
// long tail via the backend instead.
const VOICE_KEYWORDS = {
  taken: [
    'took my medicine', 'i took my medicine', 'took it', 'i took it', 'medicine taken', 'medication taken',
    'दवा ले ली', 'मैंने दवा ले ली', 'दवाई ले ली',                         // Hindi
    'మందు వేసుకున్నాను', 'నేను మందు తీసుకున్నాను',                          // Telugu
    'மருந்து எடுத்துக்கொண்டேன்', 'மருந்து சாப்பிட்டேன்',                    // Tamil
    'ಔಷಧಿ ತೆಗೆದುಕೊಂಡೆ', 'ಮಾತ್ರೆ ತೆಗೆದುಕೊಂಡೆ',                              // Kannada
    'മരുന്ന് കഴിച്ചു', 'ഗുളിക കഴിച്ചു',                                    // Malayalam
    'औषध घेतले', 'गोळी घेतली',                                              // Marathi
    'ওষুধ খেয়েছি', 'আমি ওষুধ খেয়েছি',                                      // Bengali
    'દવા લીધી', 'મેં દવા લીધી',                                             // Gujarati
    'ਦਵਾਈ ਲੈ ਲਈ', 'ਮੈਂ ਦਵਾਈ ਲੈ ਲਈ',                                        // Punjabi
    'دوا لے لی', 'میں نے دوا لے لی',                                        // Urdu
    'tomé mi medicina', 'ya tomé mi medicina',                              // Spanish
    "j'ai pris mon médicament",                                             // French
    '我吃了药', '我已经吃药了',                                              // Chinese
    'tomei meu remédio',                                                    // Portuguese
  ],
  checkin: [
    'i am fine', "i'm fine", 'feeling fine', 'feeling good', 'doing well',
    'मैं ठीक हूं', 'मैं ठीक हूँ',
    'నేను బాగున్నాను', 'நான் நலமாக இருக்கிறேன்',
    'ನಾನು ಚೆನ್ನಾಗಿದ್ದೇನೆ', 'ഞാൻ സുഖമായിരിക്കുന്നു',
    'मी ठीक आहे', 'আমি ভালো আছি', 'હું સારો છું', 'ਮੈਂ ਠੀਕ ਹਾਂ', 'میں ٹھیک ہوں',
    'estoy bien', 'ça va bien', '我很好', 'estou bem',
  ],
  water: [
    'drank water', 'had water', 'glass of water',
    'पानी पिया', 'मैंने पानी पिया', 'నీళ్ళు తాగాను', 'தண்ணீர் குடித்தேன்',
    'ನೀರು ಕುಡಿದೆ', 'വെള്ളം കുടിച്ചു', 'पाणी प्यायलो', 'পানি খেয়েছি',
    'પાણી પીધું', 'ਪਾਣੀ ਪੀਤਾ', 'پانی پیا',
    'bebí agua', "j'ai bu de l'eau", '我喝了水', 'bebi água',
  ],
  walk: [
    'went for a walk', 'i walked', 'took a walk',
    'मैं टहला', 'टहलने गया', 'నడిచాను', 'நடந்தேன்',
    'ನಡೆದೆ', 'നടന്നു', 'फिरायला गेलो', 'হেঁটেছি', 'ચાલવા ગયો', 'ਸੈਰ ਕੀਤੀ', 'چہل قدمی کی',
    'fui a caminar', 'je suis allé marcher', '我散步了', 'fui caminhar',
  ],
};

export function matchVoiceKeyword(text) {
  const t = text.toLowerCase();
  for (const kw of VOICE_KEYWORDS.taken) if (t.includes(kw.toLowerCase())) return 'taken';
  for (const kw of VOICE_KEYWORDS.checkin) if (t.includes(kw.toLowerCase())) return 'checkin';
  for (const kw of VOICE_KEYWORDS.water) if (t.includes(kw.toLowerCase())) return 'water';
  for (const kw of VOICE_KEYWORDS.walk) if (t.includes(kw.toLowerCase())) return 'walk';
  return null;
}

export function findMedicineInText(text, medicines) {
  const t = text.toLowerCase();
  return medicines.find(m => t.includes(m.name.toLowerCase()));
}

// Thin wrapper around @react-native-voice/voice's callback API, turned into
// promises/callbacks that are easier to use from a React component.
//
// STUBBED while @react-native-voice/voice is disabled (see note at top of
// file) — original implementation preserved below for easy restoration:
//
// export function initVoice({ onStart, onEnd, onResult, onError }) {
//   Voice.onSpeechStart = () => onStart && onStart();
//   Voice.onSpeechEnd = () => onEnd && onEnd();
//   Voice.onSpeechResults = (e) => onResult && onResult(e.value?.[0] || '');
//   Voice.onSpeechPartialResults = (e) => onResult && onResult(e.value?.[0] || '', true);
//   Voice.onSpeechError = (e) => onError && onError(e.error);
// }
export function initVoice({ onStart, onEnd, onResult, onError }) {
  // No-op — nothing to wire up since there's no native recognizer active.
}

// export async function startVoiceRecognition(langCode) {
//   await Voice.start(langCode);
// }
export async function startVoiceRecognition(langCode) {
  throw new Error('Voice recognition is temporarily unavailable — please use the on-screen buttons or type your response instead.');
}

// export async function stopVoiceRecognition() {
//   await Voice.stop();
// }
export async function stopVoiceRecognition() {
  // No-op — nothing was ever started.
}

// export async function destroyVoice() {
//   await Voice.destroy();
//   Voice.removeAllListeners();
// }
export async function destroyVoice() {
  // No-op.
}

// export async function isVoiceAvailable() {
//   try {
//     const services = await Voice.getSpeechRecognitionServices();
//     return Array.isArray(services) && services.length > 0;
//   } catch (e) {
//     return false;
//   }
// }
export async function isVoiceAvailable() {
  // Always false while disabled — VoiceModal.js already has a complete,
  // working fallback UI (tap-to-select chips/buttons in guided mode, a
  // text input in free-form mode) for exactly this case, so the Voice
  // Assistant feature keeps working, just without live listening.
  return false;
}
