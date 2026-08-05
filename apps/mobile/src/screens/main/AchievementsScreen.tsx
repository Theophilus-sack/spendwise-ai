import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '@/components/ui';
import { Colors, Typography, Spacing, Radius } from '@/theme';
import { BADGES } from '@spendwise/shared';
import type { BadgeId } from '@spendwise/shared';
import { useAuthStore } from '@/store/authStore';
import { useExpenseStore } from '@/store/expenseStore';
import { useBudgetStore } from '@/store/budgetStore';
import { useGoalStore } from '@/store/goalStore';
import { useIncomeStore } from '@/store/incomeStore';
import { useDisciplineStore } from '@/store/disciplineStore';
import { supabase } from '@/lib/supabase';
import { evaluateBadges } from '@/lib/badges';

export function AchievementsScreen() {
  const user            = useAuthStore(s => s.user);
  const profile         = useAuthStore(s => s.profile);
  const expenses        = useExpenseStore(s => s.expenses);
  const loadExpenses    = useExpenseStore(s => s.load);
  const budgets         = useBudgetStore(s => s.budgets);
  const loadBudgets     = useBudgetStore(s => s.load);
  const goals           = useGoalStore(s => s.goals);
  const loadGoals       = useGoalStore(s => s.load);
  const incomeEntries   = useIncomeStore(s => s.entries);
  const loadIncome      = useIncomeStore(s => s.load);
  const grade           = useDisciplineStore(s => s.grade);
  const loadDiscipline  = useDisciplineStore(s => s.load);

  const [hasAiConversation, setHasAiConversation] = useState(false);
  const [hasDebtPayment,    setHasDebtPayment]    = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      const [, , , , , aiCheck, debtPaymentCheck] = await Promise.all([
        loadExpenses(user.id),
        loadBudgets(user.id),
        loadGoals(user.id),
        loadIncome(user.id),
        loadDiscipline(user.id),
        supabase.from('ai_conversations').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('debt_payments').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      ]);
      if (cancelled) return;
      setHasAiConversation((aiCheck.count ?? 0) > 0);
      setHasDebtPayment((debtPaymentCheck.count ?? 0) > 0);
      setReady(true);
    })();

    return () => { cancelled = true; };
  }, [user?.id]);

  if (!ready) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  const badgeList = Object.values(BADGES);
  const unlocked: Record<BadgeId, boolean> = evaluateBadges({
    expenses,
    goals,
    budgets,
    incomeEntries,
    monthlyIncome: profile?.monthlyIncome ?? 0,
    disciplineGrade: grade,
    hasAiConversation,
    hasDebtPayment,
  });
  const unlockedCount = badgeList.filter(b => unlocked[b.id]).length;

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        data={badgeList}
        keyExtractor={b => b.id}
        numColumns={2}
        contentContainerStyle={styles.list}
        columnWrapperStyle={styles.row}
        ListHeaderComponent={
          <Text style={styles.summary}>{unlockedCount} of {badgeList.length} unlocked</Text>
        }
        renderItem={({ item: badge }) => {
          const isUnlocked = unlocked[badge.id];
          return (
            <Card style={[styles.badge, !isUnlocked && styles.badgeLocked]}>
              <Text style={styles.badgeEmoji}>{badge.emoji}</Text>
              <Text style={styles.badgeName}>{badge.name}</Text>
              <Text style={styles.badgeDesc} numberOfLines={2}>{badge.description}</Text>
              <View style={[styles.tag, isUnlocked && styles.tagUnlocked]}>
                <Text style={[styles.tagText, isUnlocked && styles.tagTextUnlocked]}>
                  {isUnlocked ? 'Unlocked' : 'Locked'}
                </Text>
              </View>
            </Card>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: Colors.background },
  centered:     { flex: 1, alignItems: 'center', justifyContent: 'center' },
  summary:      { fontSize: Typography.sm, color: Colors.textSecondary, marginBottom: Spacing.sm, textAlign: 'center' },
  list:         { padding: Spacing.base, gap: Spacing.sm, paddingBottom: 80 },
  row:          { gap: Spacing.sm },
  badge:        { flex: 1, alignItems: 'center', gap: Spacing.xs, padding: Spacing.md },
  badgeLocked:  { opacity: 0.55 },
  badgeEmoji:   { fontSize: 36 },
  badgeName:    { fontSize: Typography.sm, fontWeight: Typography.bold, color: Colors.text, textAlign: 'center' },
  badgeDesc:    { fontSize: Typography.xs, color: Colors.textSecondary, textAlign: 'center' },
  tag:             { backgroundColor: Colors.border, borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  tagUnlocked:     { backgroundColor: Colors.primaryLight },
  tagText:         { fontSize: Typography.xs, color: Colors.textSecondary, fontWeight: Typography.semibold, textTransform: 'uppercase' },
  tagTextUnlocked: { color: Colors.textInverse },
});
