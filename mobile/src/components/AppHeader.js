import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Crown, MessageCircle } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';

export default function AppHeader({ tier, mode, setMode, onOpenChat, onOpenPlans }) {
  const { colors } = useTheme();
  // Fixed navy, not colors.primary — primary flips to gold in dark mode
  // (intentional for buttons/accents there), but this header is a brand
  // identity bar that should look the same regardless of light/dark mode,
  // the same way a company's header color doesn't change with a website's
  // dark-mode toggle.
  const HEADER_BG = '#1A2856';
  return (
    <View style={{ backgroundColor: HEADER_BG, borderBottomWidth: 3, borderBottomColor: colors.amber, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <View style={{ flex: 1, marginRight: 10 }}>
          <Text style={{ fontSize: 22, fontWeight: '800', color: '#FFFFFF' }}>Caretaker24</Text>
          <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 3 }}>Keeping Families Connected Through Care</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <TouchableOpacity
            onPress={onOpenPlans}
            style={{
              backgroundColor: colors.amber, borderRadius: 99, paddingHorizontal: 12, paddingVertical: 8, minHeight: 36,
              flexDirection: 'row', alignItems: 'center', gap: 5,
              shadowColor: colors.amber, shadowOpacity: 0.4, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3,
            }}
          >
            <Crown size={15} color={HEADER_BG} />
            <Text style={{ fontSize: 12, fontWeight: '800', color: HEADER_BG }}>{(tier || 'free').toUpperCase()}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onOpenChat}
            style={{
              backgroundColor: colors.amber, borderRadius: 99, width: 40, height: 40, alignItems: 'center', justifyContent: 'center',
              shadowColor: colors.amber, shadowOpacity: 0.4, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3,
            }}
          >
            <MessageCircle size={18} color={HEADER_BG} />
          </TouchableOpacity>
        </View>
      </View>
      {setMode && (
        <View style={{ flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 99, padding: 3 }}>
          {['senior', 'family'].map(m => (
            <TouchableOpacity key={m} onPress={() => setMode(m)} style={{ flex: 1, paddingVertical: 9, minHeight: 40, borderRadius: 99, backgroundColor: mode === m ? colors.amber : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontWeight: '700', fontSize: 14, color: mode === m ? HEADER_BG : '#FFFFFF' }}>{m === 'senior' ? 'Senior View' : 'Family View'}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}
