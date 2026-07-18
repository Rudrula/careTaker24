import { apiJson } from './apiClient';

// ---- templates & listing ----
export function getCircleTemplates() { return apiJson('/api/care-circles/templates'); }
export function listCircles() { return apiJson('/api/care-circles'); }
export function getCircle(id) { return apiJson(`/api/care-circles/${id}`); }

// ---- create / update / lifecycle ----
export function createCircle(body) {
  return apiJson('/api/care-circles', { method: 'POST', body: JSON.stringify(body) });
}
export function updateCircle(id, body) {
  return apiJson(`/api/care-circles/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
}
export function deleteCircle(id) {
  return apiJson(`/api/care-circles/${id}`, { method: 'DELETE' });
}
export function archiveCircle(id) {
  return apiJson(`/api/care-circles/${id}/archive`, { method: 'POST' });
}
export function restoreCircle(id) {
  return apiJson(`/api/care-circles/${id}/restore`, { method: 'POST' });
}
export function duplicateCircle(id, includeMembers = false) {
  return apiJson(`/api/care-circles/${id}/duplicate`, { method: 'POST', body: JSON.stringify({ includeMembers }) });
}
export function transferOwnership(id, newOwnerUserId) {
  return apiJson(`/api/care-circles/${id}/transfer-ownership`, { method: 'POST', body: JSON.stringify({ newOwnerUserId }) });
}
export function leaveCircle(id) {
  return apiJson(`/api/care-circles/${id}/leave`, { method: 'POST' });
}
export function setActiveCircle(id) {
  return apiJson(`/api/care-circles/${id}/set-active`, { method: 'POST' });
}

// ---- members ----
export function listMembers(id) { return apiJson(`/api/care-circles/${id}/members`); }
export function updateMember(id, userId, body) {
  return apiJson(`/api/care-circles/${id}/members/${userId}`, { method: 'PATCH', body: JSON.stringify(body) });
}
export function removeMember(id, userId) {
  return apiJson(`/api/care-circles/${id}/members/${userId}`, { method: 'DELETE' });
}

// ---- blocked users ----
export function listBlockedUsers(id) { return apiJson(`/api/care-circles/${id}/blocked-users`); }
export function blockUser(id, body) {
  return apiJson(`/api/care-circles/${id}/block-user`, { method: 'POST', body: JSON.stringify(body) });
}
export function unblockUser(id, blockId) {
  return apiJson(`/api/care-circles/${id}/block-user/${blockId}`, { method: 'DELETE' });
}

// ---- missed-dose alert (fires the moment the client detects a NEW miss) ----
export function reportMissedDose(medicineId) {
  return apiJson(`/api/medicines/${medicineId}/missed-alert`, { method: 'POST' });
}
