import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from './AuthContext';
import { apiJson } from '../services/apiClient';
import { schedulePostponedReminder } from '../services/notificationService';
import { getCurrentLocationForSOS, googleMapsLink } from '../services/locationService';

const STORAGE_KEY = 'caretaker24-data';

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function daysAgoStr(n) {
  const d = new Date(); d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const SEED = {
  family: { seniorName: 'Asha Sharma', tier: 'basic', inviteCode: 'SHR7K2', familyTimezone: 'America/New_York' },
  currentUser: { name: 'Rohan Sharma', email: 'rohan@example.com', country: 'USA', bloodType: 'O+', allergies: '', conditions: '' },
  members: [
    { id: 'm1', name: 'Asha Sharma', role: 'senior', country: 'India' },
    { id: 'm2', name: 'Rohan Sharma', role: 'family', country: 'USA' },
  ],
  medicines: [
    { id: 'med1', name: 'Metformin', dosage: '500mg', form: 'tablet', time: '08:00', instructions: 'With breakfast', purpose: 'Diabetes', lastTakenDate: null, lastTakenAt: null, lastSkippedDate: null, stock: 28 },
    { id: 'med2', name: 'Amlodipine', dosage: '5mg', form: 'tablet', time: '14:00', instructions: 'After lunch', purpose: 'Blood pressure', lastTakenDate: null, lastTakenAt: null, lastSkippedDate: null, stock: 30 },
    { id: 'med3', name: 'Atorvastatin', dosage: '10mg', form: 'tablet', time: '21:00', instructions: 'Before bed', purpose: 'Cholesterol', lastTakenDate: null, lastTakenAt: null, lastSkippedDate: null, stock: 7 },
  ],
  reminders: [
    { id: 'rm1', title: 'Drink a glass of water', type: 'water', freq: 'Every 2 hours', active: true },
    { id: 'rm2', title: 'Evening walk', type: 'exercise', freq: 'Daily at 6:00 PM', active: true },
  ],
  bills: [
    { id: 'b1', name: 'Electricity Bill', amount: '₹1,450', dueDate: daysAgoStr(-3), recurring: 'monthly', paidThisCycle: false },
  ],
  contacts: [
    { id: 'c1', name: 'Rohan (Son)', phone: '+19876543210', relation: 'Son' },
    { id: 'c2', name: 'Dr. Lata Subramaniam', phone: '+919123456780', relation: 'Family Doctor' },
    { id: 'c3', name: 'Emergency Services', phone: '112', relation: 'Ambulance' },
  ],
  reports: [
    { date: todayStr(), adherence: 67, taken: 2, total: 3, waterGlasses: 5, checkIns: 2, steps: 3120, summary: null },
    { date: daysAgoStr(1), adherence: 100, taken: 3, total: 3, waterGlasses: 6, checkIns: 3, steps: 6840, summary: 'Excellent day — all medicines on time.' },
    { date: daysAgoStr(2), adherence: 67, taken: 2, total: 3, waterGlasses: 4, checkIns: 1, steps: 4210, summary: 'Missed the evening dose.' },
    { date: daysAgoStr(3), adherence: 100, taken: 3, total: 3, waterGlasses: 7, checkIns: 4, steps: 7460, summary: 'Great hydration and full adherence.' },
    { date: daysAgoStr(4), adherence: 33, taken: 1, total: 3, waterGlasses: 3, checkIns: 1, steps: 1890, summary: 'Only morning dose taken — please follow up.' },
    { date: daysAgoStr(5), adherence: 100, taken: 3, total: 3, waterGlasses: 5, checkIns: 2, steps: 5530, summary: 'Full adherence, two check-ins.' },
    { date: daysAgoStr(6), adherence: 100, taken: 3, total: 3, waterGlasses: 8, checkIns: 3, steps: 8020, summary: 'Excellent week finish.' },
  ],
  activityLog: [],
};

const DataContext = createContext(null);

// Every call below is wrapped in try/catch by its caller, so the app keeps
// working fully offline (AsyncStorage cache) even if the backend is
// unreachable — apiJson (see services/apiClient.js) additionally handles
// transparent access-token refresh on 401 before any of these ever see a
// stale-token failure.
const api = apiJson;

export function DataProvider({ children }) {
  const { authed } = useAuth();
  const [data, setData] = useState(SEED);
  const [loaded, setLoaded] = useState(false);
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) setData(JSON.parse(raw));
      } catch (e) { /* fall back to seed */ }
      setLoaded(true);
      syncFromBackend();
    })();
  }, []);

  // Re-sync the moment sign-in completes (covers email/OTP/Google/Apple/biometric —
  // all of them flip `authed` to true once a token is stored in SecureStore).
  useEffect(() => {
    if (authed) syncFromBackend();
  }, [authed]);

  // Pulls the household's real state from MongoDB via the backend and
  // replaces local data — called on load and can be called again any time
  // (e.g. pull-to-refresh) to reconcile after being offline.
  const syncFromBackend = useCallback(async () => {
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) return; // not signed in yet — stay on local/seed data
      const [meRes, medicines, contacts, bills, reports, activityLog] = await Promise.all([
        api('/api/families/me'),
        api('/api/medicines'),
        api('/api/contacts'),
        api('/api/bills'),
        api('/api/reports?limit=7'),
        api('/api/activity?limit=60'),
      ]);
      const next = {
        family: meRes.family, currentUser: meRes.user,
        members: meRes.family.members || [],
        medicines, contacts, bills, reports, activityLog,
      };
      setData(prev => {
        const merged = { ...next, reminders: prev.reminders || SEED.reminders }; // local-only feature, not backend-synced
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(merged)).catch(() => {});
        return merged;
      });
      setSynced(true);
    } catch (e) {
      // Backend unreachable or not signed in yet — silently keep local data.
      setSynced(false);
    }
  }, []);

  const persist = useCallback((next) => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const upd = useCallback((fn) => {
    setData(prev => { const next = fn(prev); persist(next); return next; });
  }, [persist]);

  const addLog = useCallback((type, message) => {
    upd(p => ({ ...p, activityLog: [{ id: `${Date.now()}`, type, message, ts: new Date().toISOString() }, ...p.activityLog].slice(0, 60) }));
  }, [upd]);

  // ---- medicines (optimistic local update + best-effort backend sync) ----
  const addMedicine = useCallback((med) => {
    const m = { id: `med-${Date.now()}`, lastTakenDate: null, lastTakenAt: null, stock: 30, ...med };
    upd(p => ({ ...p, medicines: [...p.medicines, m] }));
    addLog('medicine', `Added medicine: ${m.name}`);
    api('/api/medicines', { method: 'POST', body: JSON.stringify(med) }).then(syncFromBackend).catch(() => {});
  }, [upd, addLog, syncFromBackend]);

  const updateMedicine = useCallback((id, patch) => {
    upd(p => ({ ...p, medicines: p.medicines.map(m => m.id === id ? { ...m, ...patch } : m) }));
    api(`/api/medicines/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }).catch(() => {});
  }, [upd]);

  const markTaken = useCallback((med) => {
    const t = todayStr();
    upd(p => ({ ...p, medicines: p.medicines.map(m => m.id === med.id ? { ...m, lastTakenDate: t, lastTakenAt: new Date().toISOString(), lastSkippedDate: null } : m) }));
    addLog('medicine', `${med.name} ${med.dosage} marked taken`);
    api(`/api/medicines/${med.id}/take`, { method: 'PATCH' })
      .then(() => api('/api/reports/sync-adherence', { method: 'POST' }))
      .then(syncFromBackend)
      .catch(() => {});
  }, [upd, addLog, syncFromBackend]);

  // A deliberate "not taking this dose" decision — distinct from simply
  // letting the scheduled time pass (which shows as "Missed"). Cancels
  // today's alarm so it doesn't keep nagging about a dose the person
  // already decided to skip.
  const skipMedicine = useCallback((med) => {
    const t = todayStr();
    upd(p => ({ ...p, medicines: p.medicines.map(m => m.id === med.id ? { ...m, lastSkippedDate: t } : m) }));
    addLog('medicine', `${med.name} ${med.dosage} skipped for today`);
    api(`/api/medicines/${med.id}/skip`, { method: 'PATCH' }).then(syncFromBackend).catch(() => {});
  }, [upd, addLog, syncFromBackend]);

  // Doesn't change the medicine's taken/skipped state at all — just asks
  // the OS to remind again in N minutes via a one-off notification,
  // leaving tomorrow's recurring daily alarm untouched.
  const postponeMedicine = useCallback((med, minutes = 15) => {
    addLog('medicine', `${med.name} postponed ${minutes} min`);
    schedulePostponedReminder(med, minutes).catch(() => {});
  }, [addLog]);

  const deleteMedicine = useCallback((id) => {
    upd(p => ({ ...p, medicines: p.medicines.filter(m => m.id !== id) }));
    api(`/api/medicines/${id}`, { method: 'DELETE' }).catch(() => {});
  }, [upd]);

  // ---- bills ----
  const addBill = useCallback((bill) => {
    const rec = { id: `bill-${Date.now()}`, paidThisCycle: false, ...bill };
    upd(p => ({ ...p, bills: [...p.bills, rec] }));
    addLog('bill', `Added bill: ${rec.name}`);
    api('/api/bills', { method: 'POST', body: JSON.stringify(bill) }).then(syncFromBackend).catch(() => {});
  }, [upd, addLog, syncFromBackend]);

  const markBillPaid = useCallback((bill) => {
    upd(p => ({ ...p, bills: p.bills.map(b => b.id === bill.id ? { ...b, paidThisCycle: true } : b) }));
    addLog('bill', `Paid ${bill.name}`);
    api(`/api/bills/${bill.id}/pay`, { method: 'PATCH' }).then(syncFromBackend).catch(() => {});
  }, [upd, addLog, syncFromBackend]);

  const deleteBill = useCallback((id) => {
    upd(p => ({ ...p, bills: p.bills.filter(b => b.id !== id) }));
    api(`/api/bills/${id}`, { method: 'DELETE' }).catch(() => {});
  }, [upd]);

  // ---- general reminders (water / exercise / medicine / custom) — local-only,
  // matching the web app: these are lightweight on/off nudges, not backed by
  // their own MongoDB collection, so there's no api() call here at all.
  const addReminder = useCallback((reminder) => {
    const rec = { id: `rem-${Date.now()}`, active: true, ...reminder };
    upd(p => ({ ...p, reminders: [...(p.reminders || []), rec] }));
    addLog('reminder', `Added reminder: ${rec.title}`);
  }, [upd, addLog]);

  const toggleReminder = useCallback((id) => {
    upd(p => ({ ...p, reminders: (p.reminders || []).map(r => r.id === id ? { ...r, active: !r.active } : r) }));
  }, [upd]);

  const deleteReminder = useCallback((id) => {
    upd(p => ({ ...p, reminders: (p.reminders || []).filter(r => r.id !== id) }));
  }, [upd]);

  // ---- contacts ----
  const addContact = useCallback((c) => {
    const rec = { id: `c-${Date.now()}`, relation: 'Contact', ...c };
    upd(p => ({ ...p, contacts: [...p.contacts, rec] }));
    addLog('contact', `Added contact: ${rec.name}`);
    api('/api/contacts', { method: 'POST', body: JSON.stringify(c) }).then(syncFromBackend).catch(() => {});
  }, [upd, addLog, syncFromBackend]);

  const updateContact = useCallback((id, c) => {
    upd(p => ({ ...p, contacts: p.contacts.map(x => x.id === id ? { ...x, ...c } : x) }));
    api(`/api/contacts/${id}`, { method: 'PATCH', body: JSON.stringify(c) }).catch(() => {});
  }, [upd]);

  const deleteContact = useCallback((id) => {
    upd(p => ({ ...p, contacts: p.contacts.filter(x => x.id !== id) }));
    api(`/api/contacts/${id}`, { method: 'DELETE' }).catch(() => {});
  }, [upd]);

  // ---- check-in / water / steps ----
  const checkIn = useCallback(() => {
    addLog('checkin', `${data.family.seniorName} checked in: feeling fine`);
    api('/api/reports/checkin', { method: 'POST' }).catch(() => {});
  }, [addLog, data.family.seniorName]);

  const logWater = useCallback(() => {
    upd(p => ({ ...p, reports: p.reports.map((r, i) => i === 0 ? { ...r, waterGlasses: (r.waterGlasses || 0) + 1 } : r) }));
    addLog('water', 'Logged a glass of water');
    api('/api/reports/water', { method: 'POST' }).catch(() => {});
  }, [upd, addLog]);

  const logSteps = useCallback((amount) => {
    upd(p => ({ ...p, reports: p.reports.map((r, i) => i === 0 ? { ...r, steps: (r.steps || 0) + amount } : r) }));
    api('/api/reports/steps', { method: 'POST', body: JSON.stringify({ amount }) }).catch(() => {});
  }, [upd]);

  const triggerSOS = useCallback(async () => {
    addLog('emergency', `SOS triggered by ${data.family.seniorName} — family notified`);
    // Best-effort location — see locationService.js for why this has a hard
    // timeout and never blocks the alert on a slow/missing GPS fix.
    const location = await getCurrentLocationForSOS();
    try {
      const result = await api('/api/alerts', {
        method: 'POST',
        body: JSON.stringify(location ? { lat: location.lat, lng: location.lng } : {}),
      });
      // The backend looks up every device registered with role "family" for
      // this household and sends them a real push via Expo's push service —
      // see src/services/pushService.js for how devices get registered.
      return { mapsLink: result?.mapsLink || (location ? googleMapsLink(location.lat, location.lng) : null) };
    } catch (e) {
      // SOS is still logged locally even if the network call fails, so the
      // senior always gets a confirmation that *something* happened.
      return { mapsLink: location ? googleMapsLink(location.lat, location.lng) : null };
    }
  }, [addLog, data.family.seniorName]);

  const value = {
    data, loaded, synced, upd, addLog, syncFromBackend,
    addMedicine, updateMedicine, markTaken, skipMedicine, postponeMedicine, deleteMedicine,
    addContact, updateContact, deleteContact,
    addBill, markBillPaid, deleteBill,
    addReminder, toggleReminder, deleteReminder,
    checkIn, logWater, logSteps, triggerSOS,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}

export { todayStr };
