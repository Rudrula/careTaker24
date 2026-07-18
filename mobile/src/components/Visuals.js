import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Path, Circle, Line, Text as SvgText } from 'react-native-svg';
import { useTheme } from '../context/ThemeContext';
import { STEP_GOAL } from '../theme/theme';

export function SunArc({ medicines }) {
  const { colors } = useTheme();
  const width = 320, height = 90;
  const points = medicines.map((m, i) => {
    const [h, mm] = (m.time || '08:00').split(':').map(Number);
    const frac = Math.min(1, Math.max(0, (h * 60 + mm - 360) / (1320 - 360))); // 6am-10pm window
    const x = 20 + frac * (width - 40);
    const y = height - 10 - Math.sin(frac * Math.PI) * (height - 30);
    return { x, y, med: m };
  });
  const pathD = `M20,${height - 10} Q${width / 2},${10} ${width - 20},${height - 10}`;

  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
      <Path d={pathD} stroke={colors.border} strokeWidth={2} fill="none" />
      {points.map((p, i) => {
        const taken = p.med.lastTakenDate === new Date().toDateString();
        return (
          <Circle key={i} cx={p.x} cy={p.y} r={7} fill={taken ? colors.emerald : colors.primary} stroke={colors.card} strokeWidth={2} />
        );
      })}
    </Svg>
  );
}

export function StepRing({ steps, goal = STEP_GOAL, size = 140 }) {
  const { colors } = useTheme();
  const pct = Math.min(100, Math.round((steps / goal) * 100));
  const strokeW = 12;
  const r = (size - strokeW) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  const col = pct >= 100 ? colors.emerald : colors.primary;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.greyLt} strokeWidth={strokeW} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={col} strokeWidth={strokeW} fill="none"
          strokeDasharray={`${circ} ${circ}`} strokeDashoffset={offset} strokeLinecap="round" />
      </Svg>
      <Text style={{ fontSize: 24 }}>🚶</Text>
      <Text style={{ fontSize: 20, fontWeight: '800', color: colors.ink }}>{steps.toLocaleString()}</Text>
      <Text style={{ fontSize: 10, color: colors.muted }}>of {goal.toLocaleString()} steps</Text>
    </View>
  );
}

export function BarChart({ data, valueKey, maxValue, colorFn, labelFn }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 90, marginTop: 8 }}>
      {data.map((d, i) => {
        const val = d[valueKey] || 0;
        const pct = maxValue ? (val / maxValue) * 100 : 0;
        return (
          <View key={i} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
            <View style={{ width: '100%', height: 64, backgroundColor: colors.greyLt, borderRadius: 6, justifyContent: 'flex-end', overflow: 'hidden' }}>
              <View style={{ width: '100%', height: `${pct}%`, backgroundColor: colorFn(val), borderRadius: 6 }} />
            </View>
            <Text style={{ fontSize: 9, color: colors.muted }}>{labelFn(d)}</Text>
          </View>
        );
      })}
    </View>
  );
}
