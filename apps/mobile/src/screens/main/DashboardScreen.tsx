import React, { useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, SafeAreaView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore }    from '@/store/authStore';
import { useExpenseStore } from '@/store/expenseStore';
import { useBudgetStore }  from '@/store/budgetStore';
import { StatCard, Card, ScoreRing, BudgetBar } from '@/components/ui';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/theme';
import {
  formatCurrency, formatDateShort, getCategoryEmoji, getCategoryLabel,
  startOfMonthISO, sumBy,
} from '@spendwise/shared';
import type { AppStackNavProp } from '@/navigation/types';

export function DashboardScreen() {
  const nav     = useNavigation<AppStackNavProp>();
  const { user, profile } = useAuthStore();
  const {
    expenses, loading: expLoading, load: loadExpenses,
    getThisMonthExpenses, getTotalThisMonth, getSpendingByCategory, getBudgetStatuses,
  } = useExpenseStore();
  const { budgets, load: loadBudgets } = useBudgetStore();

  const refresh = useCallback(async () => {
    if (!user) return;
    await Promise.all([loadExpenses(user.id), loadBudgets(user.id)]);
  }, [user]);

  useEffect(() => { refresh(); }, []);

  const currency        = (profile?.currency ?? 'GHS') as any;
  const monthExpenses   = getThisMonthExpenses();
  const totalSpent      = getTotalThisMonth();
  const totalIncome     = profile?.monthlyIncome ?? 0;
  const balance         = totalIncome - totalSpent;
  const savingsRate     = totalIncome > 0 ? Math.max(0, ((totalIncome - totalSpent) / totalIncome) * 100) : 0;
  const byCategory      = getSpendingByCategory();
  const budgetStatuses  = getBudgetStatuses(budgets);
  const recentExpenses  = expenses.slice(0, 5);

  // Top budget at-risk
  const atRiskBudgets = budgetStatuses.filter(b => b.isOver || b.isNear).slice(0, 2);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const firstName = profile?.fullName?.split(' ')[0] ?? 'there';

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={expLoading} onRefresh={refresh} tintColor={Colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{greeting()}, {firstName} 👋</Text>
            <Text style={styles.date}>{new Date().toLocaleDateString('en-GH', { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => nav.navigate('Notifications')}>
              <Ionicons name="notifications-outline" size={22} color={Colors.text} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={() => nav.navigate('AIAdvisor', {})}>
              <Ionicons name="chatbubble-ellipses-outline" size={22} color={Colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Balance Hero Card ── */}
        <LinearGradient
          colors={[Colors.primaryDark, Colors.primary]}
          style={styles.heroCard}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        >
          <Text style={styles.heroLabel}>Net Balance</Text>
          <Text style={styles.heroAmount}>{formatCurrency(balance, currency)}</Text>
          <View style={styles.heroRow}>
            <View style={styles.heroStat}>
              <Ionicons name="arrow-down-circle" size={14} color="rgba(255,255,255,0.7)" />
              <Text style={styles.heroStatLabel}>Income</Text>
              <Text style={styles.heroStatValue}>{formatCurrency(totalIncome, currency)}</Text>
            </View>
            <View style={styles.heroDivider} />
            <View style={styles.heroStat}>
              <Ionicons name="arrow-up-circle" size={14} color="rgba(255,255,255,0.7)" />
              <Text style={styles.heroStatLabel}>Spent</Text>
              <Text style={styles.heroStatValue}>{formatCurrency(totalSpent, currency)}</Text>
            </View>
            <View style={styles.heroDivider} />
            <View style={styles.heroStat}>
              <Ionicons name="trending-up" size={14} color="rgba(255,255,255,0.7)" />
              <Text style={styles.heroStatLabel}>Saved</Text>
              <Text style={styles.heroStatValue}>{savingsRate.toFixed(0)}%</Text>
            </View>
          </View>
        </LinearGradient>

        {/* ── Stat Row ── */}
        <View style={styles.statRow}>
          <StatCard
            label="Transactions"
            value={String(monthExpenses.length)}
            subtitle="this month"
            icon="receipt-outline"
            iconColor={Colors.accent}
          />
          <StatCard
            label="Discipline Score"
            value="—"
            subtitle="tap to see"
            icon="shield-checkmark-outline"
            iconColor={Colors.primary}
            style={{ flex: 1 }}
          />
        </View>

        {/* ── AI Insight Banner ── */}
        <TouchableOpacity
          style={styles.insightBanner}
          onPress={() => nav.navigate('AIAdvisor', { initialMessage: 'Give me a quick insight about my spending this month.' })}
          activeOpacity={0.85}
        >
          <View style={styles.insightLeft}>
            <Text style={styles.insightEmoji}>🤖</Text>
            <View>
              <Text style={styles.insightTitle}>AI Insight</Text>
              <Text style={styles.insightBody} numberOfLines={2}>
                Tap to get a personalised analysis of your spending this month.
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.primary} />
        </TouchableOpacity>

        {/* ── Budget Overview ── */}
        {budgetStatuses.length > 0 && (
          <Section title="Budget Overview" onViewAll={() => {}}>
            {atRiskBudgets.length > 0 ? (
              atRiskBudgets.map(b => (
                <Card key={b.id} style={styles.budgetItem}>
                  <View style={styles.budgetHeader}>
                    <Text style={styles.budgetEmoji}>{getCategoryEmoji(b.category as any)}</Text>
                    <Text style={styles.budgetCategory}>{getCategoryLabel(b.category as any)}</Text>
                    {b.isOver && (
                      <View style={styles.overBadge}>
                        <Text style={styles.overBadgeText}>OVER</Text>
                      </View>
                    )}
                  </View>
                  <BudgetBar spent={b.spent} limit={b.limitAmount} currency={currency} />
                </Card>
              ))
            ) : (
              <Card>
                <Text style={styles.allGoodText}>✅ All budgets on track this month!</Text>
              </Card>
            )}
          </Section>
        )}

        {/* ── Spending Forecast Teaser ── */}
        <TouchableOpacity
          style={styles.forecastCard}
          onPress={() => nav.navigate('Forecast')}
          activeOpacity={0.85}
        >
          <View style={styles.forecastLeft}>
            <Text style={styles.forecastEmoji}>📈</Text>
            <View>
              <Text style={styles.forecastTitle}>Spending Forecast</Text>
              <Text style={styles.forecastSub}>See where you'll end up this month</Text>
            </View>
          </View>
          <Ionicons name="arrow-forward-circle" size={24} color={Colors.primary} />
        </TouchableOpacity>

        {/* ── Recent Transactions ── */}
        <Section title="Recent" onViewAll={() => {}}>
          {recentExpenses.length > 0 ? (
            recentExpenses.map(e => (
              <View key={e.id} style={styles.txRow}>
                <View style={[styles.txIcon, { backgroundColor: Colors.categories[e.category as keyof typeof Colors.categories] + '22' }]}>
                  <Text style={styles.txEmoji}>{getCategoryEmoji(e.category)}</Text>
                </View>
                <View style={styles.txInfo}>
                  <Text style={styles.txName} numberOfLines={1}>
                    {e.merchantName ?? e.description ?? getCategoryLabel(e.category)}
                  </Text>
                  <Text style={styles.txDate}>{formatDateShort(e.date)}</Text>
                </View>
                <Text style={styles.txAmount}>-{formatCurrency(e.amount, currency)}</Text>
              </View>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>📭</Text>
              <Text style={styles.emptyText}>No expenses yet this month</Text>
              <TouchableOpacity onPress={() => nav.navigate('AddExpense', {})}>
                <Text style={styles.emptyAction}>Log your first expense →</Text>
              </TouchableOpacity>
            </View>
          )}
        </Section>

        {/* ── Quick Actions ── */}
        <View style={styles.quickActions}>
          {[
            { icon: 'camera-outline',    label: 'Scan Receipt', screen: 'ReceiptScanner' },
            { icon: 'analytics-outline', label: 'Analytics',    screen: 'Analytics' },
            { icon: 'trophy-outline',    label: 'Achievements', screen: 'Achievements' },
            { icon: 'git-compare-outline', label: 'What-If',    screen: 'WhatIfSimulator' },
          ].map(({ icon, label, screen }) => (
            <TouchableOpacity
              key={screen}
              style={styles.quickBtn}
              onPress={() => nav.navigate(screen as any)}
              activeOpacity={0.8}
            >
              <Ionicons name={icon as any} size={22} color={Colors.primary} />
              <Text style={styles.quickLabel}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

function Section({
  title, onViewAll, children,
}: { title: string; onViewAll: () => void; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <TouchableOpacity onPress={onViewAll}>
          <Text style={styles.sectionAction}>See all</Text>
        </TouchableOpacity>
      </View>
      <Card style={styles.sectionCard}>
        {children}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.background },
  scroll:  { flex: 1 },
  content: { padding: Spacing.base, gap: Spacing.base, paddingBottom: Spacing.xxxl },

  // Header
  header:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingTop: Spacing.sm },
  greeting:      { fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.text },
  date:          { fontSize: Typography.sm, color: Colors.textSecondary, marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: Spacing.sm },
  iconBtn:       { width: 38, height: 38, borderRadius: Radius.full, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center', ...Shadows.sm },

  // Hero
  heroCard:      { borderRadius: Radius.xl, padding: Spacing.lg, gap: Spacing.md, ...Shadows.primary },
  heroLabel:     { fontSize: Typography.sm, color: 'rgba(255,255,255,0.75)', fontWeight: Typography.medium },
  heroAmount:    { fontSize: Typography.xxxl, fontWeight: Typography.bold, color: '#fff', letterSpacing: -1 },
  heroRow:       { flexDirection: 'row', alignItems: 'center' },
  heroStat:      { flex: 1, alignItems: 'center', gap: 2 },
  heroStatLabel: { fontSize: Typography.xs, color: 'rgba(255,255,255,0.65)' },
  heroStatValue: { fontSize: Typography.base, fontWeight: Typography.semibold, color: '#fff' },
  heroDivider:   { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.2)' },

  // Stats
  statRow: { flexDirection: 'row', gap: Spacing.sm },

  // AI insight
  insightBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primary + '10', borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.primary + '30', padding: Spacing.base, gap: Spacing.sm },
  insightLeft:   { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  insightEmoji:  { fontSize: 28 },
  insightTitle:  { fontSize: Typography.sm, fontWeight: Typography.bold, color: Colors.primary },
  insightBody:   { fontSize: Typography.xs, color: Colors.textSecondary, marginTop: 2 },

  // Budget
  budgetItem:   { gap: Spacing.sm },
  budgetHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  budgetEmoji:  { fontSize: 18 },
  budgetCategory: { flex: 1, fontSize: Typography.base, fontWeight: Typography.medium, color: Colors.text },
  overBadge:    { backgroundColor: Colors.dangerLight, paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.full },
  overBadgeText:{ fontSize: Typography.xs, color: Colors.danger, fontWeight: Typography.bold },
  allGoodText:  { fontSize: Typography.base, color: Colors.success, fontWeight: Typography.medium, padding: Spacing.sm },

  // Forecast
  forecastCard:  { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.base, ...Shadows.sm },
  forecastLeft:  { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  forecastEmoji: { fontSize: 28 },
  forecastTitle: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.text },
  forecastSub:   { fontSize: Typography.xs, color: Colors.textSecondary, marginTop: 2 },

  // Transactions
  section:       { gap: Spacing.sm },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle:  { fontSize: Typography.base, fontWeight: Typography.bold, color: Colors.text },
  sectionAction: { fontSize: Typography.sm, color: Colors.primary, fontWeight: Typography.medium },
  sectionCard:   { gap: Spacing.sm },

  txRow:   { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xs },
  txIcon:  { width: 40, height: 40, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  txEmoji: { fontSize: 20 },
  txInfo:  { flex: 1 },
  txName:  { fontSize: Typography.base, fontWeight: Typography.medium, color: Colors.text },
  txDate:  { fontSize: Typography.xs, color: Colors.textSecondary },
  txAmount:{ fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.text },

  // Empty state
  emptyState:  { alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.sm },
  emptyEmoji:  { fontSize: 40 },
  emptyText:   { fontSize: Typography.base, color: Colors.textSecondary },
  emptyAction: { fontSize: Typography.base, color: Colors.primary, fontWeight: Typography.semibold },

  // Quick actions
  quickActions: { flexDirection: 'row', gap: Spacing.sm },
  quickBtn:     { flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md, alignItems: 'center', gap: Spacing.xs, ...Shadows.sm },
  quickLabel:   { fontSize: 10, color: Colors.textSecondary, fontWeight: Typography.medium, textAlign: 'center' },
});
