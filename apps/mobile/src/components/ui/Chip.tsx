import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle } from 'react-native';
import { Colors, Typography, Spacing, Radius } from '@/theme';

type Variant = 'default' | 'success' | 'warning' | 'danger';

interface ChipProps {
  label: string;
  icon?: React.ReactNode;
  active?: boolean;
  onPress?: () => void;
  variant?: Variant;
  style?: ViewStyle;
}

// The one shared "pill with an icon" component — replaces the local
// chip/tag StyleSheet objects most screens were reinventing on their own,
// and takes an Ionicons node (never an emoji prop) so category/status
// chips stop drifting into ad hoc emoji.
export function Chip({
  label, icon, active = false, onPress, variant = 'default', style,
}: ChipProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.8}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={label}
      accessibilityState={onPress ? { selected: active } : undefined}
      style={[
        styles.base,
        styles[variant],
        active && styles.active,
        style,
      ]}
    >
      {icon}
      <Text style={[styles.text, styles[`text_${variant}`], active && styles.textActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.surfaceAlt,
  },
  active: { borderColor: Colors.primary, backgroundColor: Colors.primary + '18' },

  default: {},
  success: { borderColor: Colors.success + '40', backgroundColor: Colors.success + '12' },
  warning: { borderColor: Colors.warning + '40', backgroundColor: Colors.warning + '12' },
  danger:  { borderColor: Colors.danger + '40',  backgroundColor: Colors.danger + '12' },

  text:         { fontSize: Typography.sm, color: Colors.textSecondary, fontWeight: Typography.medium },
  text_default: {},
  text_success: { color: Colors.success, fontWeight: Typography.semibold },
  text_warning: { color: Colors.warning, fontWeight: Typography.semibold },
  text_danger:  { color: Colors.danger,  fontWeight: Typography.semibold },
  textActive:   { color: Colors.primary, fontWeight: Typography.semibold },
});
