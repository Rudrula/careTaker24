const { Expo } = require('expo-server-sdk');
const Device = require('../models/Device');

const expo = new Expo();

async function sendToDevices(devices, { title, body, data = {}, categoryId }) {
  const messages = devices
    .filter(d => Expo.isExpoPushToken(d.expoPushToken))
    .map(d => ({
      to: d.expoPushToken,
      sound: 'default',
      title,
      body,
      data,
      priority: 'high',
      ...(categoryId ? { categoryId } : {}), // must match a category the client already registered via setNotificationCategoryAsync, or the action buttons silently don't appear
    }));
  if (!messages.length) return { sent: 0 };

  const chunks = expo.chunkPushNotifications(messages);
  let sent = 0;
  const staleTokens = [];
  for (const chunk of chunks) {
    const tickets = await expo.sendPushNotificationsAsync(chunk);
    tickets.forEach((ticket, i) => {
      if (ticket.status === 'ok') sent += 1;
      else if (ticket.details?.error === 'DeviceNotRegistered') staleTokens.push(chunk[i].to);
    });
  }
  if (staleTokens.length) await Device.deleteMany({ expoPushToken: { $in: staleTokens } });
  return { sent };
}

async function pushToRole(familyId, role, payload) {
  const devices = await Device.find({ familyId, role });
  return sendToDevices(devices, payload);
}

// Targets specific members by userId within one circle — used for
// missed-dose alerts, which go to whichever member(s) were explicitly
// flagged as the "primary contact" (e.g. the son who set himself as
// primary for "Parents Care"), not to an entire role at once.
async function pushToUserIds(familyId, userIds, payload) {
  if (!userIds.length) return { sent: 0 };
  const devices = await Device.find({ familyId, userId: { $in: userIds } });
  return sendToDevices(devices, payload);
}

module.exports = { pushToRole, pushToUserIds };
