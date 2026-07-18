import React, { useState } from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { X, MessageCircle } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { openWhatsAppTo, buildSOSMessage } from '../services/whatsappService';

// Shown right after the in-app SOS alert already went out to every
// family-role member — this is an ADDITIONAL channel, not a replacement,
// for reaching someone specific (a neighbor, a contact who doesn't have
// the app, a doctor) via WhatsApp with the same emergency message and
// location. The in-app alert never waits on this modal or on WhatsApp
// being installed.
export default function SOSWhatsAppModal({ visible, onClose, contacts, seniorName, mapsLink }) {
  const { colors } = useTheme();
  const [sendingId, setSendingId] = useState(null);

  async function handleSend(contact) {
    setSendingId(contact.id);
    try {
      await openWhatsAppTo(contact.phone, buildSOSMessage(seniorName, mapsLink));
    } finally {
      setSendingId(null);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(13,27,62,0.6)', justifyContent: 'center', padding: 16 }}>
        <View style={{ backgroundColor: colors.card, borderRadius: 24, padding: 24, maxHeight: '75%' }}>
          <TouchableOpacity onPress={onClose} style={{ position: 'absolute', top: 16, right: 16, zIndex: 1, width: 32, height: 32, borderRadius: 99, backgroundColor: colors.cardAlt, alignItems: 'center', justifyContent: 'center' }}>
            <X size={18} color={colors.muted} />
          </TouchableOpacity>

          <View style={{ alignItems: 'center', marginBottom: 16 }}>
            <View style={{ width: 52, height: 52, borderRadius: 99, backgroundColor: 'rgba(37,211,102,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
              <MessageCircle size={24} color="#25D366" />
            </View>
            <Text style={{ fontWeight: '800', fontSize: 17, color: colors.ink }}>Also notify via WhatsApp?</Text>
            <Text style={{ fontSize: 12, color: colors.muted, marginTop: 4, textAlign: 'center' }}>
              {mapsLink ? 'Includes your current location' : 'Location wasn\'t available for this alert'}
            </Text>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {(contacts || []).length === 0 && (
              <Text style={{ fontSize: 13, color: colors.muted, textAlign: 'center', paddingVertical: 20 }}>
                No contacts saved yet — add one from the Contacts tab.
              </Text>
            )}
            {(contacts || []).map(c => (
              <TouchableOpacity
                key={c.id}
                onPress={() => handleSend(c)}
                disabled={sendingId === c.id}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderRadius: 12, backgroundColor: colors.cardAlt, marginBottom: 8 }}
              >
                <View>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.ink }}>{c.name}</Text>
                  <Text style={{ fontSize: 11, color: colors.muted }}>{c.relation} · {c.phone}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#25D366', borderRadius: 99, paddingHorizontal: 12, paddingVertical: 7 }}>
                  <MessageCircle size={13} color="#fff" />
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{sendingId === c.id ? 'Opening…' : 'Send'}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TouchableOpacity onPress={onClose} style={{ marginTop: 14, alignItems: 'center' }}>
            <Text style={{ color: colors.muted, fontSize: 13 }}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
