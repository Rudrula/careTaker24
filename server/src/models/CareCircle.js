const mongoose = require('mongoose');
const { applyCleanJSON } = require('./_helpers');

function randomInviteCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

// Fixed set of circle "types" used to pick a default icon/color and to
// pre-fill sensible defaults when creating from a template (see
// careCircleTemplates.js). "custom" covers anything typed in freehand.
const CIRCLE_TYPES = ['general', 'parents', 'pregnancy', 'child', 'family', 'grandparents', 'pet', 'custom'];

// IMPORTANT: this is a relationship *persona* (who this person is to the
// circle), not a capability level — it's already load-bearing elsewhere
// (e.g. SOS alerts push to every member with role "family" via
// pushService.pushToRole). Ownership is tracked separately via
// CareCircle.ownerId (see transferOwnership), and fine-grained capability
// control lives in the `permissions` sub-object below — deliberately kept
// as two independent axes instead of one conflated "owner/admin/member"
// role enum.
const MEMBER_ROLES = ['senior', 'family', 'caregiver', 'viewer'];
const MEMBER_STATUSES = ['active', 'invited', 'blocked', 'left', 'removed'];

const DEFAULT_PERMISSIONS = {
  canEditMedicines: true,
  canManageBilling: true,
  canInviteMembers: false,
  canManageMembers: false,
  canDeleteCircle: false,
  canViewReports: true,
};

const OWNER_PERMISSIONS = {
  canEditMedicines: true,
  canManageBilling: true,
  canInviteMembers: true,
  canManageMembers: true,
  canDeleteCircle: true,
  canViewReports: true,
};

const memberSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  role: { type: String, enum: MEMBER_ROLES, default: 'family' },
  permissions: {
    canEditMedicines: { type: Boolean, default: true },
    canManageBilling: { type: Boolean, default: true },
    canInviteMembers: { type: Boolean, default: false },
    canManageMembers: { type: Boolean, default: false },
    canDeleteCircle: { type: Boolean, default: false },
    canViewReports: { type: Boolean, default: true },
  },
  status: { type: String, enum: MEMBER_STATUSES, default: 'active' },
  // The member(s) who receive a push notification when a medicine dose in
  // this circle goes unmarked past its scheduled time — e.g. "the son"
  // explicitly designated as primary contact for missed-dose alerts on
  // "Parents Care." Multiple members can be flagged; if none are, the
  // missed-dose route falls back to every 'owner'/'admin' member so alerts
  // are never silently dropped.
  isPrimaryContact: { type: Boolean, default: false },
  invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  joinedAt: { type: Date, default: Date.now },
  leftAt: { type: Date, default: null },
}, { _id: false });

const careCircleSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 60 },
  type: { type: String, enum: CIRCLE_TYPES, default: 'general' },
  icon: { type: String, default: '🏠' }, // emoji shown in the circle switcher
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // Legacy/simple fields carried over from the original single-Family model —
  // every existing route (medicines, bills, contacts, reports, etc.) reads
  // these off `req.family`, which now resolves to whichever CareCircle is
  // the caller's currently active one. Nothing about those routes changes.
  seniorName: { type: String, default: 'Senior' },
  tier: { type: String, enum: ['free', 'basic', 'premium'], default: 'free' },
  familyTimezone: { type: String, default: 'America/New_York' },

  inviteCode: { type: String, required: true, unique: true, default: randomInviteCode, index: true },
  members: [memberSchema],

  status: { type: String, enum: ['active', 'archived', 'deleted'], default: 'active', index: true },
  archivedAt: { type: Date, default: null },
  deletedAt: { type: Date, default: null }, // soft delete — see restore()

  createdFromTemplate: { type: String, default: null },
  duplicatedFromCircleId: { type: mongoose.Schema.Types.ObjectId, ref: 'CareCircle', default: null },
}, { timestamps: true });

careCircleSchema.index({ 'members.userId': 1, status: 1 });

applyCleanJSON(careCircleSchema);

careCircleSchema.statics.CIRCLE_TYPES = CIRCLE_TYPES;
careCircleSchema.statics.MEMBER_ROLES = MEMBER_ROLES;
careCircleSchema.statics.DEFAULT_PERMISSIONS = DEFAULT_PERMISSIONS;
careCircleSchema.statics.OWNER_PERMISSIONS = OWNER_PERMISSIONS;

module.exports = mongoose.model('CareCircle', careCircleSchema);
