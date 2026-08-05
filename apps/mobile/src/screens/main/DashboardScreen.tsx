import React, { useEffect, useCallback, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore }    from '@/store/authStore';
import { useExpenseStore } from '@/store/expenseStore';
import { useBudgetStore }  from '@/store/budgetStore';
import { useIncomeStore }  from '@/store/incomeStore';
import { useWeeklyReflectionStore } from '@/store/weeklyReflectionStore';
import { useDisciplineStore } from '@/store/disciplineStore';
import { StatCard, Card, BudgetBar } from '@/components/ui';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/theme';
import {
  formatCurrency, formatCompact, formatDateShort, getCategoryEmoji, getCategoryLabel,
} from '@spendwise/shared';
import type { HomeTabNavProp } from '@/navigation/types';

export function DashboardScreen() {
  const nav     = useNavigation<HomeTabNavProp>();
  const { user, profile } = useAuthStore();
  const {
    expenses, loading: expLoading, load: loadExpenses,
    getThisMonthExpenses, getTotalThisMonth, getBudgetStatuses,
  } = useExpenseStore();
  const { budgets, load: loadBudgets }               = useBudgetStore();
  const { entries, load: loadIncome, getTotalThisMonth: getIncomeThisMonth } = useIncomeStore();
  const { current: currentReflection, streak: reflectionStreak, load: loadReflection } = useWeeklyReflectionStore();
  const { score, grade, load: loadScore } = useDisciplineStore();

  const [coachDismissed, setCoachDismissed] = useState(false);

  // Pulsing animation for AI coach banner
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.03, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const refresh = useCallback(async () => {
    if (!user) return;
    await Promise.all([loadExpenses(user.id), loadBudgets(user.id), loadIncome(user.id), loadReflection(user.id), loadScore(user.id)]);
  }, [user]);

  useEffect(() => { refresh(); }, []);

  const currency       = (profile?.currency ?? 'GHS') as any;
  const monthExpenses  = getThisMonthExpenses();
  const totalSpent     = getTotalThisMonth();
  const baseSalary     = profile?.monthlyIncome ?? 0;
  const altIncome      = getIncomeThisMonth();
  const totalIncome    = baseSalary + altIncome;
  const balance        = totalIncome - totalSpent;
  const savingsRate    = totalIncome > 0 ? Math.max(0, ((totalIncome - totalSpent) / totalIncome) * 100) : 0;
  const budgetStatuses = getBudgetStatuses(budgets);
  const recentExpenses = expenses.slice(0, 5);
  const atRiskBudgets  = budgetStatuses.filter(b => b.isOver || b.isNear).slice(0, 2);

  // Income health: % of income already spent (0-100)
  const incomeSpentPct   = totalIncome > 0 ? Math.min((totalSpent / totalIncome) * 100, 100) : 0;
  const incomeHealthColor =
    incomeSpentPct < 60  ? Colors.success :
    incomeSpentPct < 85  ? Colors.warning :
                           Colors.danger;
  const incomeHealthLabel =
    incomeSpentPct < 60  ? 'Healthy – you\'re well within income' :
    incomeSpentPct < 85  ? 'Moderate – spending is approaching income' :
                           'Critical – spending is nearly all of income';

  // Overall budget health — "on track" only means something once budgets
  // actually exist. Onboarding always creates a row per category (even with
  // $0 limits when income is unset/skipped), so budgets.length alone isn't
  // a reliable signal — check for an actual nonzero limit instead.
  const totalBudgetLimit = budgets.reduce((s, b) => s + b.limitAmount, 0);
  const budgetSpentPct   = totalBudgetLimit > 0 ? Math.min((totalSpent / totalBudgetLimit) * 100, 100) : 0;
  const overBudgetCount  = budgetStatuses.filter(b => b.isOver).length;
  const hasBudgets       = totalBudgetLimit > 0;
  const budgetHealthOk   = hasBudgets && overBudgetCount === 0;
  const budgetColor      = !hasBudgets ? Colors.textTertiary : budgetHealthOk ? Colors.success : Colors.danger;

  // Show AI coach when any budget is exceeded
  const showAICoach = overBudgetCount > 0 && !coachDismissed;

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

        {/* ── Weekly Reflection prompt ── */}
        <TouchableOpacity
          style={[styles.reflectionPill, currentReflection && styles.reflectionPillDone]}
          onPress={() => nav.navigate('WeeklyReflection', {})}
          activeOpacity={0.85}
        >
          <Ionicons
            name={currentReflection ? 'checkmark-circle' : 'sync-outline'}
            size={16}
            color={currentReflection ? Colors.success : Colors.primary}
          />
          <Text style={[styles.reflectionPillText, currentReflection && { color: Colors.success }]}>
            {currentReflection ? 'Reflected this week' : 'Weekly Reflection'}
          </Text>
          {reflectionStreak > 0 && <Text style={styles.reflectionStreakText}>🔥 {reflectionStreak}</Text>}
        </TouchableOpacity>

        {/* ── Balance Hero Card ── */}
        <LinearGradient
          colors={[Colors.primaryDark, Colors.primary]}
          style={styles.heroCard}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        >
          <Text style={styles.heroLabel}>Net Balance</Text>
          <Text style={styles.heroAmount} numberOfLines={1} adjustsFontSizeToFit>{formatCurrency(balance, currency)}</Text>
          <View style={styles.heroRow}>
            <View style={styles.heroStat}>
              <Ionicons name="arrow-down-circle" size={14} color="rgba(255,255,255,0.7)" />
              <Text style={styles.heroStatLabel}>Income</Text>
              <Text style={styles.heroStatValue} numberOfLines={1} adjustsFontSizeToFit>{formatCompact(totalIncome, currency)}</Text>
            </View>
            <View style={styles.heroDivider} />
            <View style={styles.heroStat}>
              <Ionicons name="arrow-up-circle" size={14} color="rgba(255,255,255,0.7)" />
              <Text style={styles.heroStatLabel}>Spent</Text>
              <Text style={styles.heroStatValue} numberOfLines={1} adjustsFontSizeToFit>{formatCompact(totalSpent, currency)}</Text>
            </View>
            <View style={styles.heroDivider} />
            <View style={styles.heroStat}>
              <Ionicons name="trending-up" size={14} color="rgba(255,255,255,0.7)" />
              <Text style={styles.heroStatLabel}>Saved</Text>
              <Text style={styles.heroStatValue} numberOfLines={1} adjustsFontSizeToFit>{savingsRate.toFixed(0)}%</Text>
            </View>
          </View>
        </LinearGradient>

        {/* ── Income Section ── */}
        <Card style={styles.incomeSection}>
          <View style={styles.incomeSectionHeader}>
            <View style={styles.incomeTitleRow}>
              <Ionicons name="wallet-outline" size={18} color={Colors.primary} />
              <Text style={styles.incomeSectionTitle}>Income Overview</Text>
            </View>
            <TouchableOpacity onPress={() => nav.navigate('Income')} style={styles.manageBtn}>
              <Text style={styles.manageBtnText}>Manage</Text>
              <Ionicons name="chevron-forward" size={14} color={Colors.primary} />
            </TouchableOpacity>
          </View>

          {/* Primary income row */}
          <View style={styles.incomeRow}>
            <View style={styles.incomeIcon}><Text style={{ fontSize: 16 }}>💼</Text></View>
            <View style={styles.incomeInfo}>
              <Text style={styles.incomeLabel}>Base Salary</Text>
              <Text style={styles.incomeSubLabel}>Primary · monthly</Text>
            </View>
            <Text style={styles.incomeValue}>{formatCurrency(baseSalary, currency)}</Text>
          </View>

          {/* Alt income rows (up to 2) */}
          {entries.slice(0, 2).map(e => (
            <View key={e.id} style={styles.incomeRow}>
              <View style={styles.incomeIcon}><Text style={{ fontSize: 16 }}>💸</Text></View>
              <View style={styles.incomeInfo}>
                <Text style={styles.incomeLabel}>{e.sourceName ?? e.source}</Text>
                <Text style={styles.incomeSubLabel}>{e.isRecurring ? 'Recurring' : 'One-time'} · {e.date}</Text>
              </View>
              <Text style={styles.incomeValue}>{formatCurrency(e.amount, currency)}</Text>
            </View>
          ))}

          {entries.length > 2 && (
            <TouchableOpacity onPress={() => nav.navigate('Income')}>
              <Text style={styles.viewMoreText}>+{entries.length - 2} more income sources</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.addIncomeRow} onPress={() => nav.navigate('Income')}>
            <Ionicons name="add-circle-outline" size={18} color={Colors.primary} />
            <Text style={styles.addIncomeText}>Add alternative income</Text>
          </TouchableOpacity>

          {/* ── Income health bar ── */}
          <View style={styles.healthBarSection}>
            <View style={styles.healthBarHeader}>
              <Text style={styles.healthBarTitle}>Income Status</Text>
              <Text style={[styles.healthBarPct, { color: incomeHealthColor }]}>{incomeSpentPct.toFixed(0)}% spent</Text>
            </View>
            <View style={styles.healthTrack}>
              <View style={[styles.healthFill, { width: `${incomeSpentPct}%` as any, backgroundColor: incomeHealthColor }]} />
            </View>
            <Text style={[styles.healthLabel, { color: incomeHealthColor }]}>{incomeHealthLabel}</Text>
          </View>
        </Card>

        {/* ── Budget Health Bar ── */}
        <Card style={styles.budgetHealthCard}>
          <View style={styles.budgetHealthHeader}>
            <Ionicons
              name={!hasBudgets ? 'help-circle-outline' : budgetHealthOk ? 'shield-checkmark-outline' : 'warning-outline'}
              size={20}
              color={budgetColor}
            />
            <Text style={styles.budgetHealthTitle}>Overall Budget Health</Text>
            <View style={[styles.healthBadge, { backgroundColor: budgetColor + '18', borderColor: budgetColor + '40' }]}>
              <Text style={[styles.healthBadgeText, { color: budgetColor }]}>
                {!hasBudgets ? 'NO BUDGETS' : budgetHealthOk ? 'ON TRACK' : `${overBudgetCount} OVER`}
              </Text>
            </View>
          </View>
          {hasBudgets && (
            <View style={styles.healthTrack}>
              <View style={[styles.healthFill, { width: `${Math.min(budgetSpentPct, 100)}%` as any, backgroundColor: budgetColor }]} />
            </View>
          )}
          <Text style={[styles.budgetHealthMsg, { color: budgetColor }]}>
            {!hasBudgets
              ? 'Set up a budget to start tracking your spending health.'
              : budgetHealthOk
              ? '✅ You\'re doing well — all budgets are on track this month!'
              : `⚠️ ${overBudgetCount} budget${overBudgetCount > 1 ? 's' : ''} exceeded — review your spending to get back on track.`}
          </Text>
        </Card>

        {/* ── AI Coach Banner (when over budget) ── */}
        {showAICoach && (
          <Animated.View style={[styles.coachBanner, { transform: [{ scale: pulseAnim }] }]}>
            <LinearGradient colors={['#1A1A2E', '#2D1B69']} style={styles.coachGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <View style={styles.coachTop}>
                <View style={styles.coachLeft}>
                  <Text style={styles.coachEmoji}>🤖</Text>
                  <View>
                    <Text style={styles.coachTitle}>AI Coach Alert</Text>
                    <Text style={styles.coachSub}>You've exceeded {overBudgetCount} budget{overBudgetCount > 1 ? 's' : ''} this month</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => setCoachDismissed(true)}>
                  <Ionicons name="close-circle" size={22} color="rgba(255,255,255,0.5)" />
                </TouchableOpacity>
              </View>
              <Text style={styles.coachBody}>
                I can help you cut costs and find affordable alternatives based on your spending and location.
              </Text>
              <TouchableOpacity
                style={styles.coachBtn}
                onPress={() => nav.navigate('AIAdvisor', {
                  initialMessage: `I've exceeded my budget in ${overBudgetCount} categor${overBudgetCount > 1 ? 'ies' : 'y'} this month. Help me minimise costs and suggest more affordable alternatives I can switch to based on my location and budget.`,
                })}
              >
                <Text style={styles.coachBtnText}>Get cost-saving tips →</Text>
              </TouchableOpacity>
            </LinearGradient>
          </Animated.View>
        )}

        {/* ── Stat Row ── */}
        <View style={styles.statRow}>
          <StatCard
            label="Transactions"
            value={String(monthExpenses.length)}
            subtitle="this month"
            icon="receipt-outline"
            iconColor={Colors.accent}
          />
          <TouchableOpacity activeOpacity={0.8} style={{ flex: 1 }} onPress={() => nav.navigate('ScoreDetail')}>
            <StatCard
              label="Discipline Score"
              value={score !== null ? String(score) : '—'}
              subtitle={grade ? `Grade ${grade} · tap for details` : 'tap to see'}
              icon="shield-checkmark-outline"
              iconColor={Colors.primary}
              style={{ flex: 1 }}
            />
          </TouchableOpacity>
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
          <Section title="Budget Overview" onViewAll={() => nav.navigate('Budget')}>
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
        <Section title="Recent" onViewAll={() => nav.navigate('Expenses')}>
          {recentExpenses.length > 0 ? (
            recentExpenses.map(e => (
              <View key={e.id} style={styles.txRow}>
                <View style={[styles.txIcon, { backgroundColor: (Colors.categories[e.category as keyof typeof Colors.categories] ?? Colors.textTertiary) + '22' }]}>
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
            { icon: 'camera-outline',      label: 'Scan Receipt', screen: 'ReceiptScanner' },
            { icon: 'analytics-outline',   label: 'Analytics',    screen: 'Analytics' },
            { icon: 'trophy-outline',      label: 'Goals',        screen: 'Goals' },
            { icon: 'git-compare-outline', label: 'What-If',      screen: 'WhatIfSimulator' },
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

  header:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingTop: Spacing.sm },
  greeting:      { fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.text },
  date:          { fontSize: Typography.sm, color: Colors.textSecondary, marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: Spacing.sm },
  iconBtn:       { width: 38, height: 38, borderRadius: Radius.full, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center', ...Shadows.sm },

  reflectionPill:     { flexDirection: 'row', alignSelf: 'flex-end', alignItems: 'center', gap: 6, backgroundColor: Colors.surface, borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, marginTop: -Spacing.sm, ...Shadows.sm },
  reflectionPillDone: { backgroundColor: Colors.success + '12' },
  reflectionPillText: { fontSize: Typography.xs, fontWeight: Typography.semibold, color: Colors.primary },
  reflectionStreakText: { fontSize: Typography.xs, fontWeight: Typography.bold, color: Colors.accentDark },

  heroCard:      { borderRadius: Radius.xl, padding: Spacing.lg, gap: Spacing.md, ...Shadows.primary },
  heroLabel:     { fontSize: Typography.sm, color: 'rgba(255,255,255,0.75)', fontWeight: Typography.medium },
  heroAmount:    { fontSize: Typography.xxxl, fontWeight: Typography.bold, color: '#fff', letterSpacing: -1 },
  heroRow:       { flexDirection: 'row', alignItems: 'center' },
  heroStat:      { flex: 1, alignItems: 'center', gap: 2 },
  heroStatLabel: { fontSize: Typography.xs, color: 'rgba(255,255,255,0.65)' },
  heroStatValue: { fontSize: Typography.base, fontWeight: Typography.semibold, color: '#fff' },
  heroDivider:   { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.2)' },

  // Income section
  incomeSection:       { gap: Spacing.sm },
  incomeSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  incomeTitleRow:      { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  incomeSectionTitle:  { fontSize: Typography.base, fontWeight: Typography.bold, color: Colors.text },
  manageBtn:           { flexDirection: 'row', alignItems: 'center', gap: 2 },
  manageBtnText:       { fontSize: Typography.sm, color: Colors.primary, fontWeight: Typography.medium },

  incomeRow:     { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xs },
  incomeIcon:    { width: 34, height: 34, borderRadius: Radius.md, backgroundColor: Colors.primary + '12', alignItems: 'center', justifyContent: 'center' },
  incomeInfo:    { flex: 1 },
  incomeLabel:   { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.text },
  incomeSubLabel:{ fontSize: Typography.xs, color: Colors.textSecondary },
  incomeValue:   { fontSize: Typography.base, fontWeight: Typography.bold, color: Colors.primary },
  viewMoreText:  { fontSize: Typography.xs, color: Colors.primary, textAlign: 'center', paddingVertical: Spacing.xs },

  addIncomeRow:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingTop: Spacing.xs, borderTopWidth: 1, borderTopColor: Colors.border },
  addIncomeText: { fontSize: Typography.sm, color: Colors.primary, fontWeight: Typography.medium },

  // Health bars
  healthBarSection: { paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border, gap: Spacing.xs },
  healthBarHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  healthBarTitle:   { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.text },
  healthBarPct:     { fontSize: Typography.sm, fontWeight: Typography.bold },
  healthTrack:      { height: 10, borderRadius: Radius.full, backgroundColor: Colors.border, overflow: 'hidden' },
  healthFill:       { height: 10, borderRadius: Radius.full },
  healthLabel:      { fontSize: Typography.xs, fontWeight: Typography.medium },

  // Budget health card
  budgetHealthCard:   { gap: Spacing.sm },
  budgetHealthHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  budgetHealthTitle:  { flex: 1, fontSize: Typography.base, fontWeight: Typography.bold, color: Colors.text },
  healthBadge:        { paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.full, borderWidth: 1 },
  healthBadgeText:    { fontSize: Typography.xs, fontWeight: Typography.bold },
  budgetHealthMsg:    { fontSize: Typography.sm, fontWeight: Typography.medium, lineHeight: 20 },

  // AI Coach
  coachBanner:   { borderRadius: Radius.xl, overflow: 'hidden', ...Shadows.lg },
  coachGradient: { padding: Spacing.base, gap: Spacing.sm },
  coachTop:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  coachLeft:     { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  coachEmoji:    { fontSize: 28 },
  coachTitle:    { fontSize: Typography.base, fontWeight: Typography.bold, color: '#fff' },
  coachSub:      { fontSize: Typography.xs, color: 'rgba(255,255,255,0.7)' },
  coachBody:     { fontSize: Typography.sm, color: 'rgba(255,255,255,0.85)', lineHeight: 20 },
  coachBtn:      { backgroundColor: Colors.accent, borderRadius: Radius.lg, padding: Spacing.sm, alignItems: 'center' },
  coachBtnText:  { color: '#fff', fontWeight: Typography.bold, fontSize: Typography.sm },

  statRow: { flexDirection: 'row', gap: Spacing.sm },

  insightBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primary + '10', borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.primary + '30', padding: Spacing.base, gap: Spacing.sm },
  insightLeft:   { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  insightEmoji:  { fontSize: 28 },
  insightTitle:  { fontSize: Typography.sm, fontWeight: Typography.bold, color: Colors.primary },
  insightBody:   { fontSize: Typography.xs, color: Colors.textSecondary, marginTop: 2 },

  budgetItem:   { gap: Spacing.sm },
  budgetHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  budgetEmoji:  { fontSize: 18 },
  budgetCategory: { flex: 1, fontSize: Typography.base, fontWeight: Typography.medium, color: Colors.text },
  overBadge:    { backgroundColor: Colors.dangerLight, paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.full },
  overBadgeText:{ fontSize: Typography.xs, color: Colors.danger, fontWeight: Typography.bold },
  allGoodText:  { fontSize: Typography.base, color: Colors.success, fontWeight: Typography.medium, padding: Spacing.sm },

  forecastCard:  { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.base, ...Shadows.sm },
  forecastLeft:  { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  forecastEmoji: { fontSize: 28 },
  forecastTitle: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.text },
  forecastSub:   { fontSize: Typography.xs, color: Colors.textSecondary, marginTop: 2 },

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

  emptyState:  { alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.sm },
  emptyEmoji:  { fontSize: 40 },
  emptyText:   { fontSize: Typography.base, color: Colors.textSecondary },
  emptyAction: { fontSize: Typography.base, color: Colors.primary, fontWeight: Typography.semibold },

  quickActions: { flexDirection: 'row', gap: Spacing.sm },
  quickBtn:     { flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md, alignItems: 'center', gap: Spacing.xs, ...Shadows.sm },
  quickLabel:   { fontSize: 10, color: Colors.textSecondary, fontWeight: Typography.medium, textAlign: 'center' },
});
