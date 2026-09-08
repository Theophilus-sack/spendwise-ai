import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from './Card';
import { Colors, Typography, Spacing } from '@/theme';

interface StatCardProps {
  label: string;
  value: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  trend?: 'up' | 'down' | 'flat';
  trendValue?: string;
  style?: ViewStyle;
}

export function StatCard({
  label, value, subtitle, icon, iconColor = Colors.primary,
  trend, trendValue, style,
}: StatCardProps) {
  const trendColor = trend === 'up' ? Colors.success : trend === 'down' ? Colors.danger : Colors.textSecondary;
  const trendIcon  = trend === 'up' ? 'trending-up' : trend === 'down' ? 'trending-down' : 'remove';

  return (
    <Card
      style={[styles.card, style]}
      accessible
      accessibilityRole="summary"
      accessibilityLabel={[label, value, trendValue, subtitle].filter(Boolean).join(', ')}
    >
      <View style={styles.header}>
        <Text style={styles.label} numberOfLines={1}>{label}</Text>
        {icon && (
          <View style={[styles.iconBg, { backgroundColor: iconColor + '18' }]}>
            <Ionicons name={icon} size={16} color={iconColor} />
          </View>
        )}
      </View>
      <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      {(subtitle || trendValue) && (
        <View style={styles.footer}>
          {trendValue && (
            <View style={styles.trendRow}>
              <Ionicons name={trendIcon as any} size={12} color={trendColor} />
              <Text style={[styles.trendText, { color: trendColor }]}>{trendValue}</Text>
            </View>
          )}
          {subtitle && <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card:      { flex: 1, gap: Spacing.xs },
  header:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label:     { fontSize: Typography.xs, color: Colors.textSecondary, fontWeight: Typography.medium, flex: 1 },
  iconBg:    { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  value:     { fontSize: Typography.xl, fontWeight: Typography.bold, color: Colors.text },
  footer:    { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, flexWrap: 'wrap' },
  trendRow:  { flexDirection: 'row', alignItems: 'center', gap: 2 },
  trendText: { fontSize: Typography.xs, fontWeight: Typography.medium },
  subtitle:  { fontSize: Typography.xs, color: Colors.textSecondary },
});
