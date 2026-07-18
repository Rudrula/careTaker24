import React from 'react';
import { TouchableOpacity, Text, View } from 'react-native';
import { ShieldAlert } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';

export default function SOSButton({ onPress }) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={{
        position: 'absolute', right: 16, bottom: 20, width: 72, height: 72, borderRadius: 99,
        backgroundColor: colors.rose, borderWidth: 3, borderColor: 'rgba(255,77,106,0.3)',
        alignItems: 'center', justifyContent: 'center',
        shadowColor: colors.rose, shadowOpacity: 0.5, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 8,
      }}
    >
      <ShieldAlert size={26} color="#fff" />
      <Text style={{ fontSize: 13, fontWeight: '800', color: '#fff', marginTop: 2 }}>SOS</Text>
    </TouchableOpacity>
  );
}
