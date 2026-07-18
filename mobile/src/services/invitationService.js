import { apiJson } from './apiClient';

export const INVITE_METHODS = [
  { value: 'qr', label: 'QR Code', icon: '📷' },
  { value: 'email', label: 'Email', icon: '✉️' },
  { value: 'phone', label: 'Mobile Number', icon: '📱' },
  { value: 'whatsapp', label: 'WhatsApp', icon: '💬' },
  { value: 'sms', label: 'SMS', icon: '📩' },
  { value: 'link', label: 'Invite Link', icon: '🔗' },
];

export function createInvitation(body) {
  return apiJson('/api/invitations', { method: 'POST', body: JSON.stringify(body) });
}

export function listInvitationsForCircle(careCircleId, status) {
  const q = new URLSearchParams({ careCircleId, ...(status ? { status } : {}) });
  return apiJson(`/api/invitations?${q.toString()}`);
}

export function listMyInvitations() {
  return apiJson('/api/invitations/mine');
}

export function getInvitationByToken(token) {
  return apiJson(`/api/invitations/token/${token}`);
}

export function acceptInvitation(token) {
  return apiJson(`/api/invitations/token/${token}/accept`, { method: 'POST' });
}

export function rejectInvitation(token) {
  return apiJson(`/api/invitations/token/${token}/reject`, { method: 'POST' });
}

export function resendInvitation(id) {
  return apiJson(`/api/invitations/${id}/resend`, { method: 'POST' });
}

export function cancelInvitation(id) {
  return apiJson(`/api/invitations/${id}/cancel`, { method: 'POST' });
}
