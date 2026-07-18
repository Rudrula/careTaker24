// Caretaker24 theme — ported 1:1 from the web prototype's colour system.
export const DARK = {
  primary: '#F5A800',
  primaryDk: '#A07830',
  primarySoft: 'rgba(201,168,76,0.15)',
  btnFill: '#1A2856',
  bg: '#1A2856',
  card: '#1E2E65',
  cardAlt: '#232F6E',
  ink: '#C9A84C',
  inkSub: '#D4B870',
  muted: '#8F7030',
  border: '#2A3870',
  rose: '#FF4D6A',
  amber: '#F5A800',
  emerald: '#22C55E',
  grey: '#3A4E90',
  greyLt: '#232F6E',
  mode: 'dark',
};

export const LIGHT = {
  primary: '#1A2856',
  primaryDk: '#0F1A3E',
  primarySoft: 'rgba(26,40,86,0.10)',
  btnFill: '#1A2856',
  bg: '#FFFFFF',
  card: '#FFFFFF',
  cardAlt: '#F4F6FF',
  ink: '#1A2856',
  inkSub: '#2A3870',
  muted: '#5B6FA8',
  border: '#D0D8F0',
  rose: '#E11D48',
  amber: '#F5A800',
  emerald: '#059669',
  grey: '#8A9FD0',
  greyLt: '#EBF0FF',
  mode: 'light',
};

export const radius = { sm: 10, md: 14, lg: 20, xl: 24, full: 999 };

export const fonts = {
  display: undefined, // falls back to system serif-ish; swap in a custom font via expo-font if desired
  body: undefined,
};

export const STEP_GOAL = 6000;
export const MED_CONDITIONS = [
  'Stomach ache', 'Fever', 'Headache', 'Blood pressure', 'Diabetes',
  'Cholesterol', 'Pain relief', 'Allergy', 'Infection', 'Cough & cold',
  'Vitamin/Supplement', 'Other',
];
