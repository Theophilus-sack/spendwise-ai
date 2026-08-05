import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore }    from '@/store/authStore';
import { useExpenseStore } from '@/store/expenseStore';
import { useBudgetStore }  from '@/store/budgetStore';
import { Card } from '@/components/ui';
import { Colors, Typography, Spacing, Radius } from '@/theme';
import {
  forecastMonthEnd, forecastByCategory,
  formatCurrency, getCategoryEmoji, getCategoryLabel,
  getCurrentMonthDays, getDaysInMonth, groupBy, sumBy,
} from '@spendwise/shared';
import type { ForecastResult } from '@spendwise/shared';

export function ForecastScreen() {
  const { profile }    = useAuthStore();
  const { expenses }   = useExpenseStore();
  const { budgets }    = useBudgetStore();
  const currency = (profile?.currency ?? 'GHS') as any;

  const [forecast, setForecast] = useState<ForecastResult | null>(null);

  useEffect(() => {
    const now    = new Date();
    const year   = now.getFullYear();
    const month  = now.getMonth() + 1;
    const { current: day, total: daysTotal } = getCurrentMonthDays();

    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
    const thisMonth  = expenses.filter(e => e.date >= monthStart);

    // Build daily totals
    const byDate  = groupBy(thisMonth, 'date');
    const dailyTotals = Object.entries(byDate).map(([date, exps]) => ({
      date,
      amount: sumBy(exps, 'amount'),
    }));

    const budgetMap = Object.fromEntries(budgets.map(b => [b.category, b.limitAmount])) as any;
    const todayISO = now.toISOString().slice(0, 10);

    const result = forecastMonthEnd(dailyTotals, day, daysTotal, undefined, todayISO);
    const byCategory = forecastByCategory(
      thisMonth.map(e => ({ date: e.date, amount: e.amount, category: e.category as any })),
      day, daysTotal, budgetMap, todayISO,
    );

    setForecast({ ...result, byCategory });
  }, [expenses, budgets]);

  if (!forecast) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loading}><ActivityIndicator color={Colors.primary} /></View>
      </SafeAreaView>
    );
  }

  const { current: day, total: daysTotal } = getCurrentMonthDays();
  const progressPct = (day / daysTotal) * 100;

  const statusColor = (s: string) => s === 'over' ? Colors.danger : s === 'at_risk' ? Colors.warning : Colors.success;
  const statusLabel = (s: string) => s === 'over' ? 'Over budget' : s === 'at_risk' ? 'At risk' : 'On track';

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Month progress */}
        <Card>
          <Text style={styles.monthLabel}>Day {day} of {daysTotal} — {progressPct.toFixed(0)}% through the month</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
          </View>
          <Text style={styles.confidence}>Forecast confidence: <Text style={{ fontWeight: Typography.bold, color: Colors.primary }}>{forecast.confidence}</Text></Text>
        </Card>

        {/* Overall forecast */}
        <Card style={styles.forecastHero}>
          <Text style={styles.heroLabel}>Projected month-end spending</Text>
          <Text style={styles.heroAmount}>{formatCurrency(forecast.projectedMonthEnd, currency)}</Text>
          <View style={styles.heroRow}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatLabel}>Spent so far</Text>
              <Text style={styles.heroStatValue}>{formatCurrency(forecast.actualToDate, currency)}</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatLabel}>Daily rate</Text>
              <Text style={styles.heroStatValue}>{formatCurrency(forecast.dailyRate, currency)}/day</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatLabel}>Days left</Text>
              <Text style={styles.heroStatValue}>{forecast.remainingDays} days</Text>
            </View>
          </View>
        </Card>

        {/* By category */}
        <Text style={styles.sectionTitle}>By Category</Text>
        {forecast.byCategory.map(c => (
          <Card key={c.category} style={styles.catRow}>
            <View style={styles.catHeader}>
              <Text style={styles.catEmoji}>{getCategoryEmoji(c.category)}</Text>
              <Text style={styles.catName}>{getCategoryLabel(c.category)}</Text>
              <View style={[styles.statusBadge, { backgroundColor: statusColor(c.status) + '20' }]}>
                <Text style={[styles.statusText, { color: statusColor(c.status) }]}>{statusLabel(c.status)}</Text>
              </View>
            </View>
            <View style={styles.catAmounts}>
              <Text style={styles.catAmount}>Actual: {formatCurrency(c.actualToDate, currency)}</Text>
              <Text style={[styles.catAmount, { color: statusColor(c.status), fontWeight: Typography.semibold }]}>
                Projected: {formatCurrency(c.projected, currency)}
              </Text>
              {c.budget && <Text style={styles.catAmount}>Budget: {formatCurrency(c.budget, currency)}</Text>}
            </View>
          </Card>
        ))}

        {forecast.byCategory.length === 0 && (
          <Card>
            <Text style={styles.emptyText}>Not enough data yet. Log a few more expenses to see your forecast.</Text>
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.background },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: Spacing.base, gap: Spacing.md, paddingBottom: Spacing.xxxl },

  monthLabel:    { fontSize: Typography.sm, color: Colors.textSecondary, marginBottom: Spacing.sm },
  progressTrack: { height: 8, backgroundColor: Colors.border, borderRadius: Radius.full, overflow: 'hidden', marginBottom: Spacing.sm },
  progressFill:  { height: 8, backgroundColor: Colors.primary, borderRadius: Radius.full },
  confidence:    { fontSize: Typography.xs, color: Colors.textSecondary },

  forecastHero:  { gap: Spacing.md, backgroundColor: Colors.primary + '08', borderColor: Colors.primary + '30', borderWidth: 1 },
  heroLabel:     { fontSize: Typography.sm, color: Colors.textSecondary },
  heroAmount:    { fontSize: Typography.xxxl, fontWeight: Typography.bold, color: Colors.text },
  heroRow:       { flexDirection: 'row' },
  heroStat:      { flex: 1, alignItems: 'center' },
  heroStatLabel: { fontSize: Typography.xs, color: Colors.textSecondary },
  heroStatValue: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.text },

  sectionTitle: { fontSize: Typography.base, fontWeight: Typography.bold, color: Colors.text },

  catRow:    { gap: Spacing.sm },
  catHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  catEmoji:  { fontSize: 20 },
  catName:   { flex: 1, fontSize: Typography.base, fontWeight: Typography.medium, color: Colors.text },
  statusBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.full },
  statusText:  { fontSize: Typography.xs, fontWeight: Typography.semibold },
  catAmounts:  { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  catAmount:   { fontSize: Typography.xs, color: Colors.textSecondary },

  emptyText: { fontSize: Typography.base, color: Colors.textSecondary, textAlign: 'center', padding: Spacing.md },
});
