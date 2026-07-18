// Single source of truth for "what does this medicine look like" — used by
// the Medicines screen cards, the add/edit form's picker, and critically by
// notificationService.js, since Expo/Android don't let a managed app swap
// out the actual notification icon per-notification without native
// drawable resources (that needs a custom dev client build, out of scope
// for a managed Expo app) — prefixing the right emoji directly into the
// notification title is the practical, fully-portable equivalent that
// still gives an elderly user an at-a-glance visual cue for pill vs.
// injection vs. liquid.
export const MEDICINE_FORMS = [
  { value: 'tablet', label: 'Tablet', icon: '💊' },
  { value: 'capsule', label: 'Capsule', icon: '💊' },
  { value: 'liquid', label: 'Liquid/Syrup', icon: '🧴' },
  { value: 'injection', label: 'Injection', icon: '💉' },
  { value: 'drops', label: 'Drops', icon: '👁️' },
  { value: 'inhaler', label: 'Inhaler', icon: '🌬️' },
  { value: 'other', label: 'Other', icon: '⭐' },
];

const FORM_ICON_MAP = Object.fromEntries(MEDICINE_FORMS.map(f => [f.value, f.icon]));

export function medicineFormIcon(form) {
  return FORM_ICON_MAP[form] || '💊';
}

export function medicineFormLabel(form) {
  return MEDICINE_FORMS.find(f => f.value === form)?.label || 'Tablet';
}
