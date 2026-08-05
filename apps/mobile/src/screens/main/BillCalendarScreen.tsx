import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '@/store/authStore';
import { useDebtStore } from '@/store/debtStore';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/theme';
import {
  formatCurrency, formatDate, daysUntilMonthlyDue, nextMonthlyDueDate, DEBT_TYPES,
} from '@spendwise/shared';
import type { Debt } from '@spendwise/shared';
import type { AppStackNavProp } from '@/navigation/types';

interface Bill {
  debt: Debt;
  amount: number;
  daysUntil: number;
  dueDate: string;
}

function dueLabel(days: number): string {
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `Due in ${days} days`;
}

function urgencyColor(days: number): string {
  if (days <= 1) return Colors.danger;
  if (days <= 3) return Colors.warning;
  return Colors.textSecondary;
}

export function BillCalendarScreen() {
  const nav = useNavigation<AppStackNavProp>();
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuthStore();
  const { debts, load } = useDebtStore();
  const currency = profile?.currency ?? 'GHS';

  useEffect(() => {
    if (user) load(user.id);
  }, [user?.id]);

  const bills = useMemo<Bill[]>(() => {
    const today = new Date();
    return debts
      .filter(d => d.status === 'active' && d.dueDayOfMonth != null && DEBT_TYPES[d.debtType].direction === 'owe')
      .map(d => ({
        debt: d,
        amount: d.minPayment ?? d.currentBalance,
        daysUntil: daysUntilMonthlyDue(d.dueDayOfMonth!, today),
        dueDate: nextMonthlyDueDate(d.dueDayOfMonth!, today),
      }))
      .sort((a, b) => a.daysUntil - b.daysUntil);
  }, [debts]);

  const dueThisMonth = useMemo(() => {
    const monthPrefix = new Date().toISOString().slice(0, 7);
    return bills.filter(b => b.dueDate.startsWith(monthPrefix));
  }, [bills]);
  const totalDueThisMonth = dueThisMonth.reduce((s, b) => s + b.amount, 0);

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      {/* ── Header — bleeds behind the status bar so it blends with it ── */}
      <LinearGradient
        colors={[Colors.primaryDark, Colors.primary]}
        style={[styles.header, { paddingTop: insets.top + Spacing.md }]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      >
        <View style={styles.headerTop}>
          <View style={styles.headerBrand}>
            <View style={styles.headerIconBg}>
              <Ionicons name="calendar" size={20} color={Colors.primary} />
            </View>
            <Text style={styles.headerTitle}>SpendWise AI</Text>
          </View>
          <TouchableOpacity style={styles.headerActionBtn} onPress={() => nav.navigate('Debts')} hitSlop={8}>
            <Ionicons name="card-outline" size={19} color="#fff" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <View style={styles.body}>
        <Text style={styles.pageTitle}>Bill Calendar</Text>
        <Text style={styles.pageSubtitle}>Never miss a payment.</Text>
      </View>

      {/* Summary card */}
      <View style={styles.summaryCard}>
        <View>
          <Text style={styles.summaryLabel}>Due this month</Text>
          <Text style={styles.summaryValue}>{formatCurrency(totalDueThisMonth, currency)}</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View>
          <Text style={styles.summaryLabel}>Upcoming bills</Text>
          <Text style={styles.summaryValue}>{dueThisMonth.length}</Text>
        </View>
      </View>

      <FlatList
        data={bills}
        keyExtractor={b => b.debt.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item: b }) => (
          <TouchableOpacity style={styles.billRow} onPress={() => nav.navigate('Debts')} activeOpacity={0.8}>
            <View style={[styles.urgencyDot, { backgroundColor: urgencyColor(b.daysUntil) }]} />
            <View style={styles.billInfo}>
              <Text style={styles.billName} numberOfLines={1}>{b.debt.label}</Text>
              <Text style={styles.billMeta}>
                {dueLabel(b.daysUntil)} · {formatDate(b.dueDate)}
                {b.debt.lenderName ? ` · ${b.debt.lenderName}` : ''}
              </Text>
            </View>
            <View style={styles.billAmountCol}>
              <Text style={styles.billAmount}>{formatCurrency(b.amount, currency)}</Text>
              {b.debt.minPayment != null && <Text style={styles.billAmountSub}>min. payment</Text>}
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🗓️</Text>
            <Text style={styles.emptyTitle}>No upcoming bills</Text>
            <Text style={styles.emptyText}>Add a due day to a loan or credit card in Debts & Loans and it'll show up here.</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => nav.navigate('Debts')}>
              <Text style={styles.emptyBtnText}>Go to Debts & Loans</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  header: {
    paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl,
    borderBottomLeftRadius: Radius.xl, borderBottomRightRadius: Radius.xl,
    ...Shadows.primary,
  },
  headerTop:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerBrand: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  headerIconBg:{ width: 40, height: 40, borderRadius: Radius.md, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: Typography.base, fontWeight: Typography.bold, color: '#fff' },
  headerActionBtn: { width: 38, height: 38, borderRadius: Radius.full, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },

  body: { paddingHorizontal: Spacing.base, paddingTop: Spacing.lg, gap: Spacing.xs },
  pageTitle:    { fontSize: Typography.xxl, fontWeight: Typography.bold, color: Colors.text },
  pageSubtitle: { fontSize: Typography.sm, color: Colors.textSecondary },

  summaryCard: { flexDirection: 'row', marginHorizontal: Spacing.base, marginTop: Spacing.base, backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.base, ...Shadows.sm },
  summaryLabel:{ fontSize: Typography.xs, color: Colors.textSecondary, marginBottom: 4 },
  summaryValue:{ fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.text },
  summaryDivider: { width: 1, backgroundColor: Colors.border, marginHorizontal: Spacing.lg },

  list: { padding: Spacing.base, gap: Spacing.sm, paddingBottom: 80 },
  billRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md, ...Shadows.sm },
  urgencyDot: { width: 8, height: 8, borderRadius: 4 },
  billInfo: { flex: 1, gap: 2 },
  billName: { fontSize: Typography.base, fontWeight: Typography.medium, color: Colors.text },
  billMeta: { fontSize: Typography.xs, color: Colors.textSecondary },
  billAmountCol: { alignItems: 'flex-end' },
  billAmount: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.text },
  billAmountSub: { fontSize: 10, color: Colors.textTertiary, marginTop: 1 },

  empty:      { alignItems: 'center', paddingTop: 80, gap: Spacing.md, paddingHorizontal: Spacing.xl },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.text },
  emptyText:  { fontSize: Typography.sm, color: Colors.textSecondary, textAlign: 'center' },
  emptyBtn:   { marginTop: Spacing.sm, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: Radius.full, backgroundColor: Colors.primary },
  emptyBtnText: { color: '#fff', fontWeight: Typography.semibold, fontSize: Typography.sm },
});
