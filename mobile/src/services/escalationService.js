import { apiJson } from './apiClient';

// ---- policy (fully configurable per Care Circle) ----
export function getEscalationPolicy() {
  return apiJson('/api/escalation-policy');
}
export function saveEscalationPolicy(body) {
  return apiJson('/api/escalation-policy', { method: 'PUT', body: JSON.stringify(body) });
}

// ---- live/historical runs ----
export function listEscalationEvents(status = 'active') {
  return apiJson(`/api/escalation-events?status=${status}`);
}
export function acknowledgeEscalation(eventId) {
  return apiJson(`/api/escalation-events/${eventId}/acknowledge`, { method: 'POST' });
}

export const ESCALATION_PHASE_LABEL = {
  reminders: 'Reminding',
  escalating: 'Escalating',
  resolved: 'Resolved',
  exhausted: 'Exhausted — no response',
};
