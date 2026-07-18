const Anthropic = require('@anthropic-ai/sdk');

let client = null;
function getClient() {
  if (!client) {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not set.');
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

const CHAT_SYSTEM_PROMPT = `You are the in-app care assistant for Caretaker24, an app that helps senior
citizens and their families with medicine reminders, bill reminders, emergency contacts,
and family monitoring. Speak warmly, simply, and patiently — many users are older adults
or worried family members abroad. Keep answers short (2-5 sentences) unless asked for more.
For general health questions, give safe, general guidance and always suggest confirming
with a real doctor for anything specific. If someone describes an emergency, tell them
clearly to use the SOS button or call emergency services right away. You are not a
substitute for professional medical care.`;

async function chat(messages) {
  const res = await getClient().messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1000,
    system: CHAT_SYSTEM_PROMPT,
    messages: messages.map(m => ({ role: m.role, content: m.content })),
  });
  return (res.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
}

async function dailyDigest(snapshot) {
  const res = await getClient().messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 300,
    system: "Write a short 3-4 sentence daily summary for a family member living abroad about their senior relative's day. Be warm and reassuring where things are fine, gently flag anything needing attention. Plain language, no bullet points.",
    messages: [{ role: 'user', content: `Today's data as JSON:\n${JSON.stringify(snapshot)}\n\nWrite the summary now.` }],
  });
  return (res.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
}

async function scanPrescription(base64Image, mediaType) {
  const res = await getClient().messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    system: `You are a medical prescription reader. Extract EVERY medicine listed. Return ONLY a JSON array, no markdown:
[{"name":"medicine name","dosage":"e.g. 500mg","frequency":"e.g. Twice daily","times":["08:00","20:00"],"condition":"one of: Stomach ache, Fever, Headache, Blood pressure, Diabetes, Cholesterol, Pain relief, Allergy, Infection, Cough & cold, Vitamin/Supplement, Other","purpose":"plain-English explanation","qty":"e.g. 30 tablets","withFood":"yes|no|not specified","store_note":""}]
If the image is not a prescription, return [].`,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Image } },
        { type: 'text', text: 'Extract the medicines as JSON.' },
      ],
    }],
  });
  const text = (res.content || []).filter(b => b.type === 'text').map(b => b.text).join('').trim();
  const cleaned = text.replace(/^```json\s*|^```\s*|```$/g, '').trim();
  try { return JSON.parse(cleaned); } catch (e) { return []; }
}

async function voiceIntent(text, medicinesContext) {
  const res = await getClient().messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 400,
    system: `You interpret a short voice command from an elderly person or family member using a care app, spoken in ANY language. Their medicines: ${(medicinesContext || []).join('; ') || 'none listed'}.

Return ONLY JSON, no markdown:
{"action":"mark_taken"|"checkin"|"water"|"walk"|"create_reminder"|"unknown","medicineName":"exact existing medicine name or empty string","reminderTitle":"short title in the SAME language the person spoke, or empty string","reminderType":"water"|"exercise"|"medicine"|"custom"|"","reminderFreq":"short human frequency phrase in the SAME language, or empty string","reply":"one short warm sentence confirming back, in the SAME language as the input"}

Rules:
- action="mark_taken" if they say they took/had an existing medicine.
- action="checkin" if they just say they're fine/feeling okay with no medicine mention.
- action="water" if they mention drinking water (a single glass, not a recurring reminder).
- action="walk" if they mention going for/completing a walk.
- action="create_reminder" if they're asking to BE REMINDED about something going forward — e.g. "remind me to drink water every 2 hours", "set a reminder to walk every evening", "remind me to take my vitamins at 9pm", in ANY language. Extract reminderTitle (what to do), reminderType (water/exercise/medicine/custom — best guess), and reminderFreq (when/how often, as the person phrased it, translated into a short natural phrase in their own language). Do NOT use this action for a one-time "I took my medicine" statement — only for a forward-looking request to be reminded.
- action="unknown" if unclear.
- reply, reminderTitle, and reminderFreq must always be in the same language the person spoke in — never translate them to English unless they spoke English.`,
    messages: [{ role: 'user', content: text }],
  });
  const raw = (res.content || []).filter(b => b.type === 'text').map(b => b.text).join('').trim();
  const cleaned = raw.replace(/^```json\s*|^```\s*|```$/g, '').trim();
  try { return JSON.parse(cleaned); } catch (e) { return { action: 'unknown', medicineName: '', reply: '' }; }
}

async function scanBill(base64Image, mediaType) {
  const res = await getClient().messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 300,
    system: 'Extract bill details from this photo. Respond ONLY with JSON, no markdown: {"name":"short bill name","amount":"amount with currency symbol as shown","dueDate":"YYYY-MM-DD","recurring":"monthly"|"yearly"|"once"}. If any field cannot be read, use an empty string.',
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Image } },
        { type: 'text', text: 'Extract the bill details as JSON.' },
      ],
    }],
  });
  const text = (res.content || []).filter(b => b.type === 'text').map(b => b.text).join('').trim();
  const cleaned = text.replace(/^```json\s*|^```\s*|```$/g, '').trim();
  try { return JSON.parse(cleaned); } catch (e) { return { name: '', amount: '', dueDate: '', recurring: 'monthly' }; }
}

module.exports = { chat, dailyDigest, scanPrescription, scanBill, voiceIntent };
