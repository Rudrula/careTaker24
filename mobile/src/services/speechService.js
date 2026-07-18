import * as Speech from 'expo-speech';

// Speaks a prompt out loud in the given language (reuses the same locale
// codes as VOICE_LANGS in voiceService.js, e.g. "en-US", "hi-IN") so the
// guided voice flow genuinely asks its questions rather than just
// displaying them as text — important for a senior who may not be looking
// at the screen when they tap the mic.
export function speak(text, langCode = 'en-US', onDone) {
  Speech.stop(); // never let two prompts overlap
  Speech.speak(text, {
    language: langCode,
    pitch: 1.0,
    rate: 0.92, // very slightly slower than default — easier to follow for elderly users
    onDone,
    onStopped: onDone,
    onError: onDone,
  });
}

export function stopSpeaking() {
  Speech.stop();
}

export async function isSpeaking() {
  return Speech.isSpeakingAsync();
}
