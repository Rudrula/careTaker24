// Static template catalog — deliberately not a DB collection since this is
// fixed product content, not user data. Exposed via GET /api/care-circles/templates
// so the mobile "Create Circle" screen can render icons/names without
// hardcoding them client-side too (single source of truth).
const TEMPLATES = [
  { id: 'general', type: 'general', name: 'MyCare', icon: '🏠', description: 'A general-purpose care circle for anyone you support.' },
  { id: 'parents', type: 'parents', name: 'Parents Care', icon: '👴👵', description: "Track your parents' medicines, appointments, and daily check-ins." },
  { id: 'pregnancy', type: 'pregnancy', name: 'Pregnancy Care', icon: '🤰', description: 'Prenatal vitamins, appointments, and wellness reminders.' },
  { id: 'child', type: 'child', name: 'Child Care', icon: '🧒', description: "Track a child's medicines, vaccinations, and check-ups." },
  { id: 'family', type: 'family', name: 'My Family', icon: '👨‍👩‍👧‍👦', description: 'Shared care coordination for your whole household.' },
  { id: 'grandparents', type: 'grandparents', name: 'Grandparents Care', icon: '👵', description: 'Coordinate care across the extended family.' },
  { id: 'pet', type: 'pet', name: 'Pet Care', icon: '🐾', description: "Medicine and vet-visit reminders for your pet." },
];

function getTemplate(id) {
  return TEMPLATES.find(t => t.id === id) || null;
}

module.exports = { TEMPLATES, getTemplate };
