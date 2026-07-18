import React from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { radius } from '../theme/theme';

export function Card({ children, style }) {
  const { colors } = useTheme();
  return (
    <View style={[{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 16, marginBottom: 12 }, style]}>
      {children}
    </View>
  );
}

export function StatusPill({ label, bg, fg, style }) {
  const { colors } = useTheme();
  return (
    <View style={[{ backgroundColor: bg || colors.primarySoft, paddingHorizontal: 12, paddingVertical: 5, borderRadius: radius.full, alignSelf: 'flex-start' }, style]}>
      <Text style={{ color: fg || colors.amber, fontSize: 13, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

export function Sect({ title, action, children }) {
  const { colors } = useTheme();
  return (
    <View style={{ marginBottom: 24 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Text style={{ fontWeight: '800', fontSize: 18, color: colors.amber, letterSpacing: 0.3 }}>{title}</Text>
        {action}
      </View>
      {children}
    </View>
  );
}

// Sizes bumped up from the original 13/14px — small tap targets and small
// text are two of the most common real accessibility failures for elderly
// users (imprecise taps from reduced fine motor control, and text that's
// genuinely hard to read even with reasonable eyesight). "sm" is still
// available for secondary in-line actions, but even it stays comfortably
// above the 44pt minimum recommended touch target height.
export function Btn({ children, onPress, variant = 'fill', disabled, full, size = 'md', loading, style }) {
  const { colors } = useTheme();
  const pad = size === 'sm' ? { paddingVertical: 11, paddingHorizontal: 18 } : { paddingVertical: 16, paddingHorizontal: 26 };
  const fs = size === 'sm' ? 15 : 17;
  const base = {
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: disabled ? 0.5 : 1,
    width: full ? '100%' : undefined,
    minHeight: size === 'sm' ? 44 : 52,
    ...pad,
  };
  const fillStyle = { backgroundColor: colors.btnFill };
  const outlineStyle = { backgroundColor: colors.btnFill };
  const ghostStyle = { backgroundColor: 'transparent' };
  const textColor = variant === 'ghost' ? colors.primary : '#FFFFFF';

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      style={[base, variant === 'fill' ? fillStyle : variant === 'outline' ? outlineStyle : ghostStyle, style]}
    >
      {loading ? <ActivityIndicator color={variant === 'ghost' ? colors.primary : '#fff'} /> : (
        typeof children === 'string' ? <Text style={{ color: textColor, fontWeight: '700', fontSize: fs }}>{children}</Text> : children
      )}
    </TouchableOpacity>
  );
}

export function Input({ label, value, onChangeText, placeholder, secureTextEntry, keyboardType, style }) {
  const { colors } = useTheme();
  return (
    <View style={{ marginBottom: 16 }}>
      {label ? <Text style={{ fontSize: 14, fontWeight: '600', color: colors.muted, marginBottom: 6 }}>{label}</Text> : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        style={[{
          width: '100%', paddingHorizontal: 16, paddingVertical: 14, borderRadius: radius.md,
          borderWidth: 1.5, borderColor: colors.border, fontSize: 16, color: colors.ink, backgroundColor: colors.cardAlt,
          minHeight: 50,
        }, style]}
      />
    </View>
  );
}

export function Toggle({ on, onToggle, label }) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      onPress={onToggle}
      activeOpacity={0.8}
      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 15, minHeight: 52, borderBottomWidth: 1, borderBottomColor: colors.border }}
    >
      <Text style={{ fontSize: 16, color: colors.ink, flex: 1 }}>{label}</Text>
      <View
        style={{ width: 52, height: 30, borderRadius: 99, backgroundColor: on ? colors.primary : colors.border, padding: 3, justifyContent: 'center' }}
      >
        <View style={{ width: 24, height: 24, borderRadius: 99, backgroundColor: '#fff', transform: [{ translateX: on ? 22 : 0 }] }} />
      </View>
    </TouchableOpacity>
  );
}

export function ChipRow({ options, selected, onSelect }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {options.map(opt => {
        const isSel = selected === opt;
        return (
          <TouchableOpacity key={opt} onPress={() => onSelect(opt)} activeOpacity={0.7}
            style={{ paddingHorizontal: 16, paddingVertical: 10, minHeight: 44, justifyContent: 'center', borderRadius: 22, borderWidth: 1.5, borderColor: isSel ? colors.primary : colors.border, backgroundColor: isSel ? colors.primarySoft : colors.cardAlt }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: isSel ? colors.primary : colors.muted }}>{opt}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
