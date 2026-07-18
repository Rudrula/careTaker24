const ActivityLog = require('../models/ActivityLog');

async function addActivity(familyId, type, message) {
  return ActivityLog.create({ familyId, type, message, ts: new Date() });
}
module.exports = { addActivity };
