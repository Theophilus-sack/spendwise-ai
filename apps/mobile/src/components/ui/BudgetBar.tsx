import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Colors, Typography, Spacing, Radius } from '@/theme';
import { formatCurrency, pct } from '@spendwise/shared';

interface BudgetBarProps {
  spent: number;
  limit: number;
  currency?: string;
  showAmounts?: boolean;
  height?: number;
}

export function BudgetBar({
  spent, limit, currency = 'GHS', showAmounts = true, height = 8,
}: BudgetBarProps) {
  const percentage = Math.min(pct(spent, limit), 100);
  const isOver     = spent > limit;
  const isNear     = percentage >= 80 && !isOver;

  const barColor = isOver ? Colors.danger : isNear ? Colors.warning : Colors.primary;

  const widthAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: percentage,
      duration: 800,
      useNativeDriver: false,
    }).start();
  }, [percentage]);

  return (
    <View style={styles.container}>
      {showAmounts && (
        <View style={styles.amounts}>
          <Text style={styles.spent}>
            {formatCurrency(spent, currency as any)} spent
          </Text>
          <Text style={[styles.remaining, isOver && styles.over]}>
            {isOver
              ? `${formatCurrency(spent - limit, currency as any)} over`
              : `${formatCurrency(limit - spent, currency as any)} left`}
          </Text>
        </View>
      )}
      <View style={[styles.track, { height }]}>
        <Animated.View
          style={[
            styles.fill,
            { height, backgroundColor: barColor },
            { width: widthAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) },
          ]}
        />
      </View>
      <Text style={[styles.pct, { color: barColor }]}>{percentage.toFixed(0)}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.xs },
  amounts:   { flexDirection: 'row', justifyContent: 'space-between' },
  spent:     { fontSize: Typography.xs, color: Colors.textSecondary },
  remaining: { fontSize: Typography.xs, color: Colors.textSecondary },
  over:      { color: Colors.danger, fontWeight: Typography.semibold },
  track:     { backgroundColor: Colors.border, borderRadius: Radius.full, overflow: 'hidden' },
  fill:      { borderRadius: Radius.full },
  pct:       { fontSize: Typography.xs, fontWeight: Typography.semibold, textAlign: 'right' },
});
