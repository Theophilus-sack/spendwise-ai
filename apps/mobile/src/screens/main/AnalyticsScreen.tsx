import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius } from '@/theme';
import { Card, BudgetBar } from '@/components/ui';
import { DonutChart, DonutLegend } from '@/components/charts/DonutChart';
import { TrendChart } from '@/components/charts/TrendChart';
import { Heatmap } from '@/components/charts/Heatmap';
import { DateRangePickerModal } from '@/components/DateRangePickerModal';
import { useAuthStore } from '@/store/authStore';
import { useExpenseStore } from '@/store/expenseStore';
import { useBudgetStore } from '@/store/budgetStore';
import { useIncomeStore } from '@/store/incomeStore';
import {
  getCategoryLabel, getCategoryEmoji, formatCurrency, formatCompact, formatDateShort,
  buildSpendingHeatmap, findPeakRiskWindows, DAY_NAMES, groupBy, sumBy,
  toISODate, startOfWeekISO, startOfMonthISO, PAYMENT_METHODS,
} from '@spendwise/shared';
import type { Expense, PaymentMethod } from '@spendwise/shared';

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

// Distinct from the category palette so a payment-method chart never looks
// like it's reusing a category's color by coincidence.
const PAYMENT_METHOD_COLORS: Record<PaymentMethod, string> = {
  mobile_money: '#F5A623',
  card:         '#45B7D1',
  cash:         '#2ECC71',
};

type PeriodType = 'day' | 'week' | 'month' | 'custom';
const PERIOD_OPTIONS: Array<{ id: PeriodType; label: string }> = [
  { id: 'day',   label: 'Day' },
  { id: 'week',  label: 'Week' },
  { id: 'month', label: 'Month' },
];

// Statement-style period navigation (day/week/month tabs + prev/next paging),
// the same pattern MTN MoMo's transaction history uses. `custom` is handled
// separately by the caller (a picked date range has no natural "anchor" to
// compute from), so this never gets called with type === 'custom'.
function getPeriodBounds(type: Exclude<PeriodType, 'custom'>, anchor: Date): { start: string; end: string; label: string } {
  if (type === 'day') {
    const iso = toISODate(anchor);
    const isToday = iso === toISODate(new Date());
    return {
      start: iso, end: iso,
      label: isToday ? 'Today' : anchor.toLocaleDateString('en-GH', { weekday: 'long', day: 'numeric', month: 'short' }),
    };
  }
  if (type === 'week') {
    const start = startOfWeekISO(anchor);
    const endDate = new Date(`${start}T00:00:00`);
    endDate.setDate(endDate.getDate() + 6);
    const end = toISODate(endDate);
    return { start, end, label: `${formatDateShort(start)} – ${formatDateShort(end)}` };
  }
  const start = startOfMonthISO(anchor);
  const endDate = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  const end = toISODate(endDate);
  return { start, end, label: anchor.toLocaleDateString('en-GH', { month: 'long', year: 'numeric' }) };
}

function shiftAnchor(anchor: Date, type: PeriodType, dir: 1 | -1): Date {
  const d = new Date(anchor);
  if (type === 'day') d.setDate(d.getDate() + dir);
  else if (type === 'week') d.setDate(d.getDate() + dir * 7);
  else d.setMonth(d.getMonth() + dir);
  return d;
}

export function AnalyticsScreen() {
  const user    = useAuthStore(s => s.user);
  const profile = useAuthStore(s => s.profile);
  const currency = profile?.currency ?? 'GHS';

  const expenses          = useExpenseStore(s => s.expenses);
  const expensesLoading   = useExpenseStore(s => s.loading);
  const loadExpenses      = useExpenseStore(s => s.load);
  const getBudgetStatuses = useExpenseStore(s => s.getBudgetStatuses);

  const budgets        = useBudgetStore(s => s.budgets);
  const budgetsLoading  = useBudgetStore(s => s.loading);
  const loadBudgets     = useBudgetStore(s => s.load);

  const incomeEntries = useIncomeStore(s => s.entries);
  const loadIncome    = useIncomeStore(s => s.load);

  const { width: screenWidth } = useWindowDimensions();

  const [periodType, setPeriodType] = useState<PeriodType>('month');
  const [anchor, setAnchor] = useState(() => new Date());
  const [customRange, setCustomRange] = useState<{ start: string; end: string } | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    if (!user) return;
    loadExpenses(user.id);
    loadBudgets(user.id);
    loadIncome(user.id);
  }, [user?.id]);

  const { start, end, label } = useMemo(() => {
    if (periodType === 'custom' && customRange) {
      const sameDay = customRange.start === customRange.end;
      return {
        start: customRange.start,
        end:   customRange.end,
        label: sameDay ? formatDateShort(customRange.start) : `${formatDateShort(customRange.start)} – ${formatDateShort(customRange.end)}`,
      };
    }
    return getPeriodBounds(periodType === 'custom' ? 'month' : periodType, anchor);
  }, [periodType, anchor, customRange]);
  const isCurrentPeriod = useMemo(() => periodType === 'custom' || end >= toISODate(new Date()), [end, periodType]);

  const periodExpenses = useMemo(
    () => expenses.filter(e => e.date >= start && e.date <= end).sort((a, b) => b.date.localeCompare(a.date) || (b.timeOfDay ?? '').localeCompare(a.timeOfDay ?? '')),
    [expenses, start, end],
  );

  const categoryData = useMemo(() => {
    const byCategory = groupBy(periodExpenses, 'category');
    return Object.entries(byCategory).map(([category, list]) => ({
      label: getCategoryLabel(category as any),
      value: sumBy(list as Expense[], 'amount'),
      color: Colors.categories[category as keyof typeof Colors.categories] ?? Colors.textTertiary,
    }));
  }, [periodExpenses]);

  const paymentMethodData = useMemo(() => {
    const byMethod = groupBy(periodExpenses, 'paymentMethod');
    return Object.entries(byMethod).map(([method, list]) => ({
      label: PAYMENT_METHODS[method as PaymentMethod]?.label ?? method,
      value: sumBy(list as Expense[], 'amount'),
      color: PAYMENT_METHOD_COLORS[method as PaymentMethod] ?? Colors.textTertiary,
    }));
  }, [periodExpenses]);

  // Base salary is a monthly figure — prorated to the selected period so a
  // single day or week doesn't misleadingly show the whole month's income.
  const periodIncome = useMemo(() => {
    const monthlyBase = profile?.monthlyIncome ?? 0;
    const proratedBase =
      periodType === 'month' ? monthlyBase :
      periodType === 'week'  ? monthlyBase / 4.33 :
      monthlyBase / 30.44;
    const extraIncome = incomeEntries
      .filter(e => e.date >= start && e.date <= end)
      .reduce((s, e) => s + e.amount, 0);
    return proratedBase + extraIncome;
  }, [profile?.monthlyIncome, incomeEntries, start, end, periodType]);

  const periodSpent = useMemo(() => sumBy(periodExpenses, 'amount'), [periodExpenses]);

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
      ? `You tend to spend most on ${DAY_NAMES[peaks[0].dayOfWeek]}s around ${formatHour(peaks[0].hourOfDay)} — averaging ${formatCurrency(peaks[0].avgAmount, currency)} per transaction.`
      : null;
    return { bucketedHeatmap: bucketed, peakWindowText: text };
  }, [expenses, timedExpenseCount, currency]);

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
        {/* ── Period Selector (statement-style, like MTN MoMo) ── */}
        <Card style={styles.periodCard}>
          <View style={styles.periodTabs}>
            {PERIOD_OPTIONS.map(p => (
              <TouchableOpacity
                key={p.id}
                style={[styles.periodTab, periodType === p.id && styles.periodTabActive]}
                onPress={() => { setPeriodType(p.id); setAnchor(new Date()); }}
              >
                <Text style={[styles.periodTabText, periodType === p.id && styles.periodTabTextActive]}>{p.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.periodCalendarBtn, periodType === 'custom' && styles.periodTabActive]}
              onPress={() => setShowDatePicker(true)}
            >
              <Ionicons name="calendar-outline" size={16} color={periodType === 'custom' ? '#fff' : Colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <View style={styles.periodNav}>
            <TouchableOpacity
              onPress={() => setAnchor(a => shiftAnchor(a, periodType === 'custom' ? 'day' : periodType, -1))}
              disabled={periodType === 'custom'}
              hitSlop={8}
              style={[periodType === 'custom' && styles.hidden]}
            >
              <Ionicons name="chevron-back" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
            <Text style={styles.periodLabel}>{label}</Text>
            <TouchableOpacity
              onPress={() => setAnchor(a => shiftAnchor(a, periodType === 'custom' ? 'day' : periodType, 1))}
              disabled={isCurrentPeriod}
              hitSlop={8}
              style={[periodType === 'custom' && styles.hidden]}
            >
              <Ionicons name="chevron-forward" size={20} color={isCurrentPeriod ? Colors.border : Colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </Card>

        <DateRangePickerModal
          visible={showDatePicker}
          onClose={() => setShowDatePicker(false)}
          initialStart={customRange?.start}
          initialEnd={customRange?.end}
          onApply={(rangeStart, rangeEnd) => {
            setCustomRange({ start: rangeStart, end: rangeEnd });
            setPeriodType('custom');
          }}
        />

        {/* ── Income vs Spending ── */}
        <Card>
          <Text style={styles.cardTitle}>Income vs Spending</Text>
          <Text style={styles.cardSub}>{label}{periodType !== 'month' && ' · income prorated from your monthly income'}</Text>
          <View style={styles.incomeRow}>
            <View style={styles.incomeCol}>
              <Text style={styles.incomeLabel}>Income</Text>
              <Text style={[styles.incomeValue, { color: Colors.success }]}>{formatCurrency(periodIncome, currency)}</Text>
            </View>
            <View style={styles.incomeCol}>
              <Text style={styles.incomeLabel}>Spent</Text>
              <Text style={[styles.incomeValue, { color: Colors.danger }]}>{formatCurrency(periodSpent, currency)}</Text>
            </View>
            <View style={styles.incomeCol}>
              <Text style={styles.incomeLabel}>Net</Text>
              <Text style={[styles.incomeValue, { color: periodIncome - periodSpent >= 0 ? Colors.text : Colors.danger }]}>
                {formatCurrency(periodIncome - periodSpent, currency)}
              </Text>
            </View>
          </View>
        </Card>

        <Card>
          <Text style={styles.cardTitle}>Spending by Category</Text>
          <Text style={styles.cardSub}>{label}</Text>
          {periodSpent === 0 ? (
            <EmptyNote text="No expenses logged in this period yet." />
          ) : (
            <>
              <View style={styles.donutRow}>
                <DonutChart data={categoryData} centerValue={formatCompact(periodSpent, currency)} centerLabel="total" />
              </View>
              <DonutLegend data={categoryData} formatValue={v => formatCurrency(v, currency)} />
            </>
          )}
        </Card>

        <Card>
          <Text style={styles.cardTitle}>Spending by Payment Method</Text>
          <Text style={styles.cardSub}>{label}</Text>
          {periodSpent === 0 ? (
            <EmptyNote text="No expenses logged in this period yet." />
          ) : (
            <>
              <View style={styles.donutRow}>
                <DonutChart data={paymentMethodData} centerValue={formatCompact(periodSpent, currency)} centerLabel="total" />
              </View>
              <DonutLegend data={paymentMethodData} formatValue={v => formatCurrency(v, currency)} />
            </>
          )}
        </Card>

        {/* ── Statement: itemized transactions for the selected period ── */}
        <Card>
          <Text style={styles.cardTitle}>Statement</Text>
          <Text style={styles.cardSub}>{periodExpenses.length} transaction{periodExpenses.length === 1 ? '' : 's'} · {label}</Text>
          {periodExpenses.length === 0 ? (
            <EmptyNote text="Nothing logged in this period yet." />
          ) : (
            <View style={styles.statementList}>
              {periodExpenses.map(e => (
                <View key={e.id} style={styles.statementRow}>
                  <View style={[styles.statementIcon, { backgroundColor: (Colors.categories[e.category as keyof typeof Colors.categories] ?? Colors.textTertiary) + '22' }]}>
                    <Text style={styles.statementEmoji}>{getCategoryEmoji(e.category)}</Text>
                  </View>
                  <View style={styles.statementInfo}>
                    <Text style={styles.statementName} numberOfLines={1}>
                      {e.merchantName ?? e.description ?? getCategoryLabel(e.category)}
                    </Text>
                    <Text style={styles.statementMeta}>
                      {formatDateShort(e.date)}{e.timeOfDay ? ` · ${e.timeOfDay}` : ''} · {PAYMENT_METHODS[e.paymentMethod]?.label ?? e.paymentMethod}
                    </Text>
                  </View>
                  <Text style={styles.statementAmount}>-{formatCurrency(e.amount, e.currency)}</Text>
                </View>
              ))}
            </View>
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

  periodCard: { gap: Spacing.sm },
  periodTabs: { flexDirection: 'row', backgroundColor: Colors.surfaceAlt, borderRadius: Radius.md, padding: 3 },
  periodTab:  { flex: 1, paddingVertical: Spacing.sm, alignItems: 'center', borderRadius: Radius.sm },
  periodTabActive: { backgroundColor: Colors.primary },
  periodTabText: { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.textSecondary },
  periodTabTextActive: { color: '#fff', fontWeight: Typography.semibold },
  periodCalendarBtn: { paddingHorizontal: Spacing.md, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.sm },
  periodNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  periodLabel: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.text },
  hidden: { opacity: 0 },

  incomeRow: { flexDirection: 'row', justifyContent: 'space-between' },
  incomeCol: { alignItems: 'center', gap: 2, flex: 1 },
  incomeLabel: { fontSize: Typography.xs, color: Colors.textSecondary },
  incomeValue: { fontSize: Typography.base, fontWeight: Typography.bold },

  statementList: { gap: Spacing.sm },
  statementRow:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  statementIcon: { width: 36, height: 36, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  statementEmoji: { fontSize: 16 },
  statementInfo: { flex: 1, gap: 1 },
  statementName: { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.text },
  statementMeta: { fontSize: Typography.xs, color: Colors.textTertiary },
  statementAmount: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.text, fontVariant: ['tabular-nums'] },
});
