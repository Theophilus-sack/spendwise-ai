import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { Colors, Typography, Spacing, Radius } from '@/theme';
import { formatCurrency, pct } from '@spendwise/shared';
import type { Currency } from '@spendwise/shared';

interface BudgetBarProps {
  spent: number;
  limit: number;
  currency?: Currency;
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

  // Reanimated, not the legacy Animated API — width isn't a transform/opacity
  // property, so the old API could only drive it on the JS thread
  // (useNativeDriver: false). Reanimated runs this on the UI thread instead.
  const widthPct = useSharedValue(0);

  useEffect(() => {
    widthPct.value = withTiming(percentage, { duration: 800 });
  }, [percentage]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${widthPct.value}%`,
  }));

  return (
    <View style={styles.container}>
      {showAmounts && (
        <View style={styles.amounts}>
          <Text style={styles.spent}>
            {formatCurrency(spent, currency)} spent
          </Text>
          <Text style={[styles.remaining, isOver && styles.over]}>
            {isOver
              ? `${formatCurrency(spent - limit, currency)} over`
              : `${formatCurrency(limit - spent, currency)} left`}
          </Text>
        </View>
      )}
      <View style={[styles.track, { height }]}>
        <Animated.View
          style={[
            styles.fill,
            { height, backgroundColor: barColor },
            fillStyle,
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
