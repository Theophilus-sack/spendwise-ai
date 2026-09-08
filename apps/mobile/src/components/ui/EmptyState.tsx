import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Button } from './Button';
import { Colors, Typography, Spacing, Radius } from '@/theme';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onPress: () => void };
}

// Replaces the ~8 independently-styled "nothing here yet" blocks that used
// a large decorative emoji as the sole graphic — one consistent icon-in-a
// circle treatment instead.
export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <View
      style={styles.container}
      accessible
      accessibilityLabel={[title, description].filter(Boolean).join('. ')}
    >
      <View style={styles.iconBg}>{icon}</View>
      <Text style={styles.title}>{title}</Text>
      {description && <Text style={styles.description}>{description}</Text>}
      {action && (
        <Button label={action.label} onPress={action.onPress} variant="outline" size="sm" style={styles.action} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, paddingVertical: Spacing.xxl, paddingHorizontal: Spacing.xl },
  iconBg: {
    width: 64, height: 64, borderRadius: Radius.full, backgroundColor: Colors.primary + '12',
    alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.xs,
  },
  title:       { fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.text, textAlign: 'center' },
  description: { fontSize: Typography.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  action:      { marginTop: Spacing.sm },
});
