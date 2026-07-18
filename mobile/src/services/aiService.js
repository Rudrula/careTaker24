// The app never talks to Anthropic directly — an API key bundled in a
// compiled app can be extracted, so every AI call goes through your own
// backend (see /server), which holds the real ANTHROPIC_API_KEY
// server-side. Every route below requires a signed-in household member
// (see the backend's requireFamily middleware), so these calls go through
// apiJson — the same resilient client used everywhere else — rather than a
// bare fetch, so an expired access token gets silently refreshed instead of
// the AI feature just failing.
import { apiJson } from './apiClient';
export { API_BASE_URL } from '../config';

function post(path, body) {
  return apiJson(path, { method: 'POST', body: JSON.stringify(body) });
}

export async function chatWithAI(messages) {
  try {
    const json = await post('/api/ai/chat', { messages });
    return json.reply;
  } catch (e) {
    return "Couldn't reach the AI assistant right now. Please try again.";
  }
}

export async function generateDailyDigest(snapshot) {
  try {
    const json = await post('/api/ai/digest', snapshot);
    return json.summary;
  } catch (e) {
    return "Couldn't generate a summary right now.";
  }
}

export async function scanPrescriptionPhoto(base64Image, mimeType) {
  // Returns an array of { name, dosage, frequency, times, condition, purpose, qty, withFood, store_note }
  const json = await post('/api/ai/scan-prescription', { image: base64Image, mimeType });
  return json.medicines || [];
}

export async function scanBillPhoto(base64Image, mimeType) {
  // Returns { name, amount, dueDate, recurring } — caller pre-fills the add-bill form with it.
  return post('/api/ai/scan-bill', { image: base64Image, mimeType });
}

export async function interpretVoiceCommand(text, medicinesContext) {
  const json = await post('/api/ai/voice-intent', { text, medicines: medicinesContext });
  return json; // { action, medicineName, reply }
}

// Powers the "AI Info" button on a medicine card — reuses the same /api/ai/chat
// endpoint as the assistant, just with a single tailored prompt instead of a
// back-and-forth conversation.
export async function explainMedicine(name, dosage, purpose) {
  return chatWithAI([{
    role: 'user',
    content: `Explain this medicine to a non-medical patient in 3-4 sentences: what it treats, how it works in simple terms, and the one key thing to remember. Never advise changing doses. Medicine: ${name} ${dosage}. ${purpose ? `Prescribed for: ${purpose}.` : ''}`,
  }]);
}
