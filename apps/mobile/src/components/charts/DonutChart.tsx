import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { Colors, Typography, Spacing } from '@/theme';

export interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  data: DonutSlice[];
  size?: number;
  strokeWidth?: number;
  centerLabel?: string;
  centerValue?: string;
}

/** A multi-segment donut built from stacked stroked circles — the same
 *  stroke-dasharray technique ScoreRing uses for a single arc, extended to
 *  multiple segments by offsetting each one along the circumference. */
export function DonutChart({ data, size = 160, strokeWidth = 26, centerLabel, centerValue }: DonutChartProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = data.reduce((s, d) => s + d.value, 0);

  let cumulative = 0;

  return (
    <View style={styles.wrap}>
      <Svg width={size} height={size}>
        <G rotation="-90" origin={`${size / 2}, ${size / 2}`}>
          {total <= 0 ? (
            <Circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={Colors.border} strokeWidth={strokeWidth} />
          ) : (
            data.filter(d => d.value > 0).map((d, i) => {
              const fraction = d.value / total;
              const dash = fraction * circumference;
              const offset = -cumulative * circumference;
              cumulative += fraction;
              return (
                <Circle
                  key={i}
                  cx={size / 2} cy={size / 2} r={radius}
                  fill="none" stroke={d.color} strokeWidth={strokeWidth}
                  strokeDasharray={`${dash} ${circumference - dash}`}
                  strokeDashoffset={offset}
                  strokeLinecap="butt"
                />
              );
            })
          )}
        </G>
      </Svg>
      {(centerLabel || centerValue) && (
        <View style={styles.center} pointerEvents="none">
          {centerValue && <Text style={styles.centerValue}>{centerValue}</Text>}
          {centerLabel && <Text style={styles.centerLabel}>{centerLabel}</Text>}
        </View>
      )}
    </View>
  );
}

interface DonutLegendProps {
  data: DonutSlice[];
  formatValue: (value: number) => string;
}

export function DonutLegend({ data, formatValue }: DonutLegendProps) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const sorted = [...data].filter(d => d.value > 0).sort((a, b) => b.value - a.value);

  return (
    <View style={styles.legend}>
      {sorted.map(d => (
        <View key={d.label} style={styles.legendRow}>
          <View style={[styles.swatch, { backgroundColor: d.color }]} />
          <Text style={styles.legendLabel} numberOfLines={1}>{d.label}</Text>
          <Text style={styles.legendValue}>{formatValue(d.value)}</Text>
          <Text style={styles.legendPct}>{total > 0 ? Math.round((d.value / total) * 100) : 0}%</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:   { alignItems: 'center', justifyContent: 'center' },
  center: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  centerValue: { fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.text },
  centerLabel: { fontSize: Typography.xs, color: Colors.textSecondary },
  legend:      { marginTop: Spacing.base, gap: Spacing.sm },
  legendRow:   { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  swatch:      { width: 10, height: 10, borderRadius: 3 },
  legendLabel: { flex: 1, fontSize: Typography.sm, color: Colors.text },
  legendValue: { fontSize: Typography.sm, color: Colors.textSecondary, fontVariant: ['tabular-nums'] },
  legendPct:   { fontSize: Typography.sm, color: Colors.textTertiary, width: 40, textAlign: 'right', fontVariant: ['tabular-nums'] },
});
