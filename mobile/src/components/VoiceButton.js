import React from 'react';
import { TouchableOpacity, Text } from 'react-native';
import { Mic } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';

export default function VoiceButton({ onPress }) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={{
        position: 'absolute', left: 16, bottom: 20, width: 68, height: 68, borderRadius: 99,
        backgroundColor: colors.btnFill, alignItems: 'center', justifyContent: 'center',
        shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6,
      }}
    >
      <Mic size={24} color="#fff" />
      <Text style={{ fontSize: 11, fontWeight: '800', color: '#fff', marginTop: 2 }}>VOICE</Text>
    </TouchableOpacity>
  );
}
