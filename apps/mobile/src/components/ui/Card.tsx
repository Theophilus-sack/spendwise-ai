import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Colors, Radius, Spacing, Shadows } from '@/theme';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  padding?: number;
  shadow?: keyof typeof Shadows;
}

export function Card({ children, style, padding = Spacing.base, shadow = 'sm' }: CardProps) {
  return (
    <View style={[styles.card, { padding }, Shadows[shadow], style]}>
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
