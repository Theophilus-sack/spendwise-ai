import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Typography, Spacing, Radius } from '@/theme';

interface HeatmapProps {
  /** rows = days, columns = time-of-day buckets */
  grid: number[][];
  rowLabels: string[];
  columnLabels: string[];
}

export function Heatmap({ grid, rowLabels, columnLabels }: HeatmapProps) {
  const max = Math.max(...grid.flat(), 0);

  return (
    <View>
      <View style={styles.headerRow}>
        <View style={styles.rowLabelSpacer} />
        {columnLabels.map(label => (
          <Text key={label} style={styles.colLabel} numberOfLines={1}>{label}</Text>
        ))}
      </View>
      {grid.map((row, r) => (
        <View key={rowLabels[r]} style={styles.row}>
          <Text style={styles.rowLabel}>{rowLabels[r]}</Text>
          {row.map((value, c) => {
            const intensity = max > 0 ? value / max : 0;
            return (
              <View
                key={c}
                style={[
                  styles.cell,
                  { backgroundColor: intensity > 0 ? withOpacity(Colors.primary, 0.12 + intensity * 0.75) : Colors.surfaceAlt },
                ]}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}

function withOpacity(hex: string, opacity: number): string {
  const alpha = Math.round(Math.min(Math.max(opacity, 0), 1) * 255).toString(16).padStart(2, '0');
  return `${hex}${alpha}`;
}

const styles = StyleSheet.create({
  headerRow:     { flexDirection: 'row', marginBottom: Spacing.xs },
  rowLabelSpacer:{ width: 44 },
  colLabel:      { flex: 1, fontSize: 9, color: Colors.textTertiary, textAlign: 'center' },
  row:           { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  rowLabel:      { width: 44, fontSize: Typography.xs, color: Colors.textSecondary },
  cell:          { flex: 1, height: 22, marginHorizontal: 1, borderRadius: Radius.xs },
});
