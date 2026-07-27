import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, ActivityIndicator, useWindowDimensions } from 'react-native';
import { Colors, Typography, Spacing } from '@/theme';
import { Card, BudgetBar } from '@/components/ui';
import { DonutChart, DonutLegend } from '@/components/charts/DonutChart';
import { TrendChart } from '@/components/charts/TrendChart';
import { Heatmap } from '@/components/charts/Heatmap';
import { useAuthStore } from '@/store/authStore';
import { useExpenseStore } from '@/store/expenseStore';
import { useBudgetStore } from '@/store/budgetStore';
import {
  getCategoryLabel, formatCurrency, formatCompact,
  buildSpendingHeatmap, findPeakRiskWindows, DAY_NAMES,
} from '@spendwise/shared';

const MIN_TIMED_EXPENSES_FOR_HEATMAP = 8;
const HOUR_BUCKETS = [
  { label: '12–4a', hours: [0, 1, 2, 3] },
  { label: '4–8a',  hours: [4, 5, 6, 7] },
  { label: '8–12p', hours: [8, 9, 10, 11] },
  { label: '12–4p', hours: [12, 13, 14, 15] },
  { label: '4–8p',  hours: [16, 17, 18, 19] },
  { label: '8–12a', hours: [20, 21, 22, 23] },
];
const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function AnalyticsScreen() {
  const user    = useAuthStore(s => s.user);
  const profile = useAuthStore(s => s.profile);
  const currency = profile?.currency ?? 'GHS';

  const expenses          = useExpenseStore(s => s.expenses);
  const expensesLoading   = useExpenseStore(s => s.loading);
  const loadExpenses      = useExpenseStore(s => s.load);
  const getSpendingByCategory = useExpenseStore(s => s.getSpendingByCategory);
  const getBudgetStatuses     = useExpenseStore(s => s.getBudgetStatuses);

  const budgets       = useBudgetStore(s => s.budgets);
  const budgetsLoading = useBudgetStore(s => s.loading);
  const loadBudgets   = useBudgetStore(s => s.load);

  const { width: screenWidth } = useWindowDimensions();

  useEffect(() => {
    if (!user) return;
    loadExpenses(user.id);
    loadBudgets(user.id);
  }, [user?.id]);

  const categoryData = useMemo(() => {
    const byCategory = getSpendingByCategory();
    return Object.entries(byCategory).map(([category, value]) => ({
      label: getCategoryLabel(category as any),
      value: value as number,
      color: Colors.categories[category as keyof typeof Colors.categories] ?? Colors.textTertiary,
    }));
  }, [expenses]);

  const budgetStatuses = useMemo(
    () => [...getBudgetStatuses(budgets)].sort((a, b) => b.percentage - a.percentage),
    [expenses, budgets],
  );

  const trendPoints = useMemo(() => {
    const days = 30;
    const totals = new Map<string, number>();
    for (const e of expenses) totals.set(e.date, (totals.get(e.date) ?? 0) + e.amount);

    const points = [];
    const cursor = new Date();
    cursor.setHours(0, 0, 0, 0);
    cursor.setDate(cursor.getDate() - (days - 1));
    for (let i = 0; i < days; i++) {
      const iso = cursor.toISOString().split('T')[0];
      points.push({ label: iso, value: totals.get(iso) ?? 0 });
      cursor.setDate(cursor.getDate() + 1);
    }
    return points;
  }, [expenses]);

  const timedExpenseCount = useMemo(() => expenses.filter(e => !!e.timeOfDay).length, [expenses]);

  const { bucketedHeatmap, peakWindowText } = useMemo(() => {
    if (timedExpenseCount < MIN_TIMED_EXPENSES_FOR_HEATMAP) {
      return { bucketedHeatmap: null, peakWindowText: null };
    }
    const hourlyGrid = buildSpendingHeatmap(expenses);
    const bucketed = hourlyGrid.map(dayRow =>
      HOUR_BUCKETS.map(b => {
        const vals = b.hours.map(h => dayRow[h]).filter(v => v > 0);
        return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
      }),
    );
    const peaks = findPeakRiskWindows(hourlyGrid, 1);
    const text = peaks.length
      ? `You tend to spend most on ${DAY_NAMES[peaks[0].dayOfWeek]}s around ${formatHour(peaks[0].hourOfDay)} — averaging ${formatCurrency(peaks[0].avgAmount, currency as any)} per transaction.`
      : null;
    return { bucketedHeatmap: bucketed, peakWindowText: text };
  }, [expenses, timedExpenseCount, currency]);

  const totalSpent = categoryData.reduce((s, d) => s + d.value, 0);
  const chartWidth = screenWidth - Spacing.base * 2 - Spacing.base * 2;
  const loading = (expensesLoading || budgetsLoading) && expenses.length === 0;

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Card>
          <Text style={styles.cardTitle}>Spending by Category</Text>
          <Text style={styles.cardSub}>This month</Text>
          {totalSpent === 0 ? (
            <EmptyNote text="Log a few expenses this month to see your category breakdown." />
          ) : (
            <>
              <View style={styles.donutRow}>
                <DonutChart data={categoryData} centerValue={formatCompact(totalSpent, currency as any)} centerLabel="total" />
              </View>
              <DonutLegend data={categoryData} formatValue={v => formatCurrency(v, currency as any)} />
            </>
          )}
        </Card>

        <Card>
          <Text style={styles.cardTitle}>Budget vs Actual</Text>
          <Text style={styles.cardSub}>This month</Text>
          {budgetStatuses.length === 0 ? (
            <EmptyNote text="Set up a budget to compare it against what you actually spend." />
          ) : (
            <View style={styles.budgetList}>
              {budgetStatuses.map(b => (
                <View key={b.id} style={styles.budgetItem}>
                  <Text style={styles.budgetCategory}>
                    {b.category === 'overall' ? 'Overall' : getCategoryLabel(b.category)}
                  </Text>
                  <BudgetBar spent={b.spent} limit={b.limitAmount} currency={currency} />
                </View>
              ))}
            </View>
          )}
        </Card>

        <Card>
          <Text style={styles.cardTitle}>30-Day Spending Trend</Text>
          <Text style={styles.cardSub}>Daily totals, last 30 days</Text>
          <View style={styles.trendWrap}>
            <TrendChart points={trendPoints} width={chartWidth} height={110} />
          </View>
          <View style={styles.trendLabels}>
            <Text style={styles.trendLabel}>{formatShortDate(trendPoints[0]?.label)}</Text>
            <Text style={styles.trendLabel}>{formatShortDate(trendPoints[trendPoints.length - 1]?.label)}</Text>
          </View>
        </Card>

        <Card>
          <Text style={styles.cardTitle}>Spending Heatmap</Text>
          <Text style={styles.cardSub}>When you tend to spend, by day and time</Text>
          {!bucketedHeatmap ? (
            <EmptyNote text="Log a few more expenses to unlock your spending heatmap." />
          ) : (
            <>
              <View style={styles.heatmapWrap}>
                <Heatmap grid={bucketedHeatmap} rowLabels={DAY_ABBR} columnLabels={HOUR_BUCKETS.map(b => b.label)} />
              </View>
              {peakWindowText && <Text style={styles.peakText}>{peakWindowText}</Text>}
            </>
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function EmptyNote({ text }: { text: string }) {
  return (
    <View style={styles.emptyNote}>
      <Text style={styles.emptyNoteText}>{text}</Text>
    </View>
  );
}

function formatHour(hour: number): string {
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h}${hour < 12 ? 'am' : 'pm'}`;
}

function formatShortDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('en-GH', { day: 'numeric', month: 'short' });
}

const styles = StyleSheet.create({
  safe:     { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content:  { padding: Spacing.base, gap: Spacing.base, paddingBottom: 80 },
  cardTitle: { fontSize: Typography.base, fontWeight: Typography.bold, color: Colors.text },
  cardSub:   { fontSize: Typography.xs, color: Colors.textSecondary, marginTop: 2, marginBottom: Spacing.sm },
  donutRow:  { alignItems: 'center', marginVertical: Spacing.sm },
  budgetList: { gap: Spacing.md },
  budgetItem: { gap: Spacing.xs },
  budgetCategory: { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.text },
  trendWrap:   { marginTop: Spacing.xs },
  trendLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.xs },
  trendLabel:  { fontSize: Typography.xs, color: Colors.textTertiary },
  heatmapWrap: { marginTop: Spacing.xs },
  peakText:    { fontSize: Typography.xs, color: Colors.textSecondary, marginTop: Spacing.sm, lineHeight: Typography.xs * Typography.normal },
  emptyNote:      { paddingVertical: Spacing.lg, alignItems: 'center' },
  emptyNoteText:  { fontSize: Typography.sm, color: Colors.textSecondary, textAlign: 'center' },
});
