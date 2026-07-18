import { apiJson } from './apiClient';

// ---- care events (scoped to whichever circle is active when called) ----
export function listCareEvents(includeCompleted = false) {
  return apiJson(`/api/care-events${includeCompleted ? '?includeCompleted=true' : ''}`);
}
export function addCareEvent(body) {
  return apiJson('/api/care-events', { method: 'POST', body: JSON.stringify(body) });
}
export function updateCareEvent(id, body) {
  return apiJson(`/api/care-events/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
}
export function deleteCareEvent(id) {
  return apiJson(`/api/care-events/${id}`, { method: 'DELETE' });
}

// ---- cross-circle Care Timeline — "Today's Family Summary" ----
// Aggregates missed doses, low stock, upcoming events, and full-adherence
// confirmations across every active Care Circle the caller belongs to —
// not just whichever one is currently active.
export function getCareTimeline() {
  return apiJson('/api/care-circles/timeline');
}

export const EVENT_TYPES = [
  { value: 'appointment', label: 'Appointment', icon: '📅' },
  { value: 'checkup', label: 'Check-up', icon: '🩺' },
  { value: 'vaccination', label: 'Vaccination', icon: '🧪' },
  { value: 'custom', label: 'Other', icon: '⭐' },
];
