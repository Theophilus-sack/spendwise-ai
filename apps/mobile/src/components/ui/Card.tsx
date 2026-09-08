import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle, AccessibilityRole } from 'react-native';
import { Colors, Radius, Spacing, Shadows } from '@/theme';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padding?: number;
  shadow?: keyof typeof Shadows;
  accessible?: boolean;
  accessibilityLabel?: string;
  accessibilityRole?: AccessibilityRole;
}

export function Card({
  children, style, padding = Spacing.base, shadow = 'sm',
  accessible, accessibilityLabel, accessibilityRole,
}: CardProps) {
  return (
    <View
      style={[styles.card, { padding }, Shadows[shadow], style]}
      accessible={accessible}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
  },
});
