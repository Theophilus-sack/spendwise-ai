import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Colors, Typography, Radius } from '@/theme';

type Variant = 'neutral' | 'success' | 'warning' | 'danger';

interface BadgeProps {
  label: string;
  variant?: Variant;
  style?: ViewStyle;
}

// Non-interactive status/count pill — distinct from Chip, which is
// pressable and used for selection/filtering.
export function Badge({ label, variant = 'neutral', style }: BadgeProps) {
  return (
    <View style={[styles.base, styles[variant], style]} accessible accessibilityLabel={label}>
      <Text style={[styles.text, styles[`text_${variant}`]]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.full },
  neutral: { backgroundColor: Colors.border },
  success: { backgroundColor: Colors.success + '18' },
  warning: { backgroundColor: Colors.warning + '18' },
  danger:  { backgroundColor: Colors.danger + '18' },

  text:         { fontSize: Typography.xs, fontWeight: Typography.semibold, textTransform: 'uppercase', letterSpacing: 0.3 },
  text_neutral: { color: Colors.textSecondary },
  text_success: { color: Colors.success },
  text_warning: { color: Colors.warning },
  text_danger:  { color: Colors.danger },
});
