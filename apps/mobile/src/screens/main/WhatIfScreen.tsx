import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Animated, Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore }   from '@/store/authStore';
import { useExpenseStore } from '@/store/expenseStore';
import { useBudgetStore }  from '@/store/budgetStore';
import { Card }            from '@/components/ui';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/theme';
import { formatCurrency, getCategoryEmoji, getCategoryLabel } from '@spendwise/shared';
import type { AppStackNavProp } from '@/navigation/types';
import type { ExpenseCategory } from '@spendwise/shared';

const ADJUSTABLE_CATEGORIES: ExpenseCategory[] = [
  'food', 'transport', 'entertainment', 'shopping', 'groceries', 'health',
];

const ALTERNATIVES: Record<string, string[]> = {
  food:          ['Cook at home instead of eating out', 'Use meal-prep to reduce daily food cost', 'Try local chop bars instead of restaurants'],
  transport:     ['Use trotro instead of Uber for short trips', 'Carpool with colleagues', 'Walk or cycle for trips under 2 km'],
  entertainment: ['Use free streaming trials before paying', 'Explore free community events', 'Share subscriptions with family'],
  shopping:      ['Buy from local markets instead of malls', 'Wait for sales before non-urgent purchases', 'Buy second-hand for non-essentials'],
  groceries:     ['Buy in bulk from wholesale markets', 'Switch to store-brand products', 'Plan meals to reduce food waste'],
  health:        ['Use NHIS-covered facilities for check-ups', 'Buy generic medications', 'Focus on preventive health habits'],
};

export function WhatIfScreen() {
  const nav = useNavigation<AppStackNavProp>();
  const { profile } = useAuthStore();
  const { getTotalThisMonth, getSpendingByCategory } = useExpenseStore();
  const { budgets } = useBudgetStore();

  const currency    = (profile?.currency ?? 'GHS') as any;
  const totalIncome = profile?.monthlyIncome ?? 0;
  const totalSpent  = getTotalThisMonth();
  const byCategory  = getSpendingByCategory();

  // Reduction sliders (0-80% reduction per category)
  const [reductions, setReductions] = useState<Record<string, number>>({});
  const [expandedAlt, setExpandedAlt] = useState<string | null>(null);

  // Blinking animation for alternatives hint
  const blinkAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(blinkAnim, { toValue: 0.3, duration: 600, easing: Easing.ease, useNativeDriver: true }),
        Animated.timing(blinkAnim, { toValue: 1,   duration: 600, easing: Easing.ease, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // Pulse animation for AI suggestion button
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.04, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 1000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // Compute simulated totals
  const savedAmount = ADJUSTABLE_CATEGORIES.reduce((total, cat) => {
    const spent = byCategory[cat] ?? 0;
    const pct   = (reductions[cat] ?? 0) / 100;
    return total + spent * pct;
  }, 0);

  const simulatedSpent   = Math.max(0, totalSpent - savedAmount);
  const simulatedBalance = totalIncome - simulatedSpent;
  const currentBalance   = totalIncome - totalSpent;
  const improvement      = simulatedBalance - currentBalance;

  const adjustCategory = (cat: string, delta: number) => {
    setReductions(prev => ({
      ...prev,
      [cat]: Math.max(0, Math.min(80, (prev[cat] ?? 0) + delta)),
    }));
  };

  const hasAnyReduction = Object.values(reductions).some(v => v > 0);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* ── Header ── */}
        <View style={styles.header}>
          <Text style={styles.emoji}>🔮</Text>
          <View style={styles.headerText}>
            <Text style={styles.title}>What-If Simulator</Text>
            <Text style={styles.subtitle}>See how small changes impact your balance</Text>
          </View>
        </View>

        {/* ── Current vs Simulated ── */}
        <View style={styles.compareRow}>
          <Card style={styles.compareCard}>
            <Text style={styles.compareLabel}>Current Balance</Text>
            <Text style={[styles.compareAmount, { color: currentBalance >= 0 ? Colors.text : Colors.danger }]}>
              {formatCurrency(currentBalance, currency)}
            </Text>
            <Text style={styles.compareSubtitle}>as of today</Text>
          </Card>
          <Ionicons name="arrow-forward" size={24} color={Colors.textSecondary} style={styles.arrow} />
          <Card style={[styles.compareCard, hasAnyReduction && styles.compareCardHighlight]}>
            <Text style={styles.compareLabel}>Simulated Balance</Text>
            <Text style={[styles.compareAmount, { color: simulatedBalance >= 0 ? Colors.success : Colors.danger }]}>
              {formatCurrency(simulatedBalance, currency)}
            </Text>
            {hasAnyReduction && (
              <Text style={styles.savingsBadge}>+{formatCurrency(improvement, currency)} saved</Text>
            )}
          </Card>
        </View>

        {/* ── Blink hint for alternatives ── */}
        <Animated.View style={[styles.blinkBanner, { opacity: blinkAnim }]}>
          <Ionicons name="bulb-outline" size={16} color={Colors.accent} />
          <Text style={styles.blinkText}>
            Tap any category below to reveal affordable local alternatives
          </Text>
        </Animated.View>

        {/* ── Category sliders ── */}
        <Text style={styles.sectionTitle}>Adjust your spending</Text>
        {ADJUSTABLE_CATEGORIES.map(cat => {
          const spent     = byCategory[cat] ?? 0;
          const reduction = reductions[cat] ?? 0;
          const saving    = spent * (reduction / 100);
          const isOpen    = expandedAlt === cat;

          return (
            <Card key={cat} style={styles.catCard}>
              <View style={styles.catHeader}>
                <Text style={styles.catEmoji}>{getCategoryEmoji(cat)}</Text>
                <View style={styles.catInfo}>
                  <Text style={styles.catName}>{getCategoryLabel(cat)}</Text>
                  <Text style={styles.catSpent}>{formatCurrency(spent, currency)} this month</Text>
                </View>
                {reduction > 0 && (
                  <Text style={styles.savingChip}>-{formatCurrency(saving, currency)}</Text>
                )}
              </View>

              {/* Reduction stepper */}
              <View style={styles.stepperRow}>
                <TouchableOpacity style={styles.stepBtn} onPress={() => adjustCategory(cat, -10)} disabled={reduction === 0}>
                  <Ionicons name="remove" size={18} color={reduction === 0 ? Colors.border : Colors.primary} />
                </TouchableOpacity>
                <View style={styles.stepperTrack}>
                  <View style={[styles.stepperFill, { width: `${reduction}%` as any }]} />
                </View>
                <Text style={styles.stepperValue}>{reduction}%</Text>
                <TouchableOpacity style={styles.stepBtn} onPress={() => adjustCategory(cat, 10)} disabled={reduction >= 80}>
                  <Ionicons name="add" size={18} color={reduction >= 80 ? Colors.border : Colors.primary} />
                </TouchableOpacity>
              </View>

              {/* Alternatives toggle */}
              <TouchableOpacity
                style={styles.altToggle}
                onPress={() => setExpandedAlt(isOpen ? null : cat)}
              >
                <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={14} color={Colors.primary} />
                <Text style={styles.altToggleText}>
                  {isOpen ? 'Hide' : 'Show'} affordable alternatives
                </Text>
              </TouchableOpacity>

              {isOpen && (
                <View style={styles.altList}>
                  {(ALTERNATIVES[cat] ?? []).map((alt, i) => (
                    <View key={i} style={styles.altRow}>
                      <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                      <Text style={styles.altText}>{alt}</Text>
                    </View>
                  ))}
                </View>
              )}
            </Card>
          );
        })}

        {/* ── Summary card ── */}
        {hasAnyReduction && (
          <LinearGradient colors={[Colors.primaryDark, Colors.primary]} style={styles.summaryCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <Text style={styles.summaryTitle}>Your potential savings</Text>
            <Text style={styles.summaryAmount}>{formatCurrency(savedAmount, currency)}</Text>
            <Text style={styles.summarySubtitle}>per month if you follow these adjustments</Text>
          </LinearGradient>
        )}

        {/* ── AI Coach suggestion ── */}
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <TouchableOpacity
            style={styles.aiCoachBtn}
            onPress={() => nav.navigate('AIAdvisor', {
              initialMessage: `Based on my spending this month, what specific adjustments can I make to reduce costs? I want affordable alternatives based on my location and budget. My total spending is ${formatCurrency(totalSpent, currency)} against an income of ${formatCurrency(totalIncome, currency)}.`,
            })}
            activeOpacity={0.88}
          >
            <LinearGradient colors={['#1A1A2E', '#2D1B69']} style={styles.aiCoachInner} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <Text style={styles.aiCoachEmoji}>🤖</Text>
              <View style={styles.aiCoachText}>
                <Text style={styles.aiCoachTitle}>Ask AI Coach for personalised advice</Text>
                <Text style={styles.aiCoachSub}>Get location-aware affordable alternatives and a tailored plan to cut costs</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.7)" />
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        {/* ── Reset ── */}
        {hasAnyReduction && (
          <TouchableOpacity style={styles.resetBtn} onPress={() => setReductions({})}>
            <Text style={styles.resetText}>Reset all adjustments</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.base, gap: Spacing.base, paddingBottom: Spacing.xxxl },

  header:     { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  emoji:      { fontSize: 40 },
  headerText: { flex: 1 },
  title:      { fontSize: Typography.xl, fontWeight: Typography.bold, color: Colors.text },
  subtitle:   { fontSize: Typography.sm, color: Colors.textSecondary, marginTop: 2 },

  compareRow:          { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  compareCard:         { flex: 1, alignItems: 'center', gap: 4 },
  compareCardHighlight:{ borderColor: Colors.success, borderWidth: 1.5 },
  compareLabel:        { fontSize: Typography.xs, color: Colors.textSecondary, fontWeight: Typography.medium, textTransform: 'uppercase' },
  compareAmount:       { fontSize: Typography.xl, fontWeight: Typography.bold },
  compareSubtitle:     { fontSize: Typography.xs, color: Colors.textSecondary },
  savingsBadge:        { fontSize: Typography.xs, fontWeight: Typography.bold, color: Colors.success, backgroundColor: Colors.success + '15', paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.full },
  arrow:               { marginHorizontal: -4 },

  blinkBanner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.accent + '15', borderRadius: Radius.md, padding: Spacing.sm, borderWidth: 1, borderColor: Colors.accent + '35' },
  blinkText:   { flex: 1, fontSize: Typography.xs, color: Colors.accent, fontWeight: Typography.medium },

  sectionTitle: { fontSize: Typography.base, fontWeight: Typography.bold, color: Colors.text },

  catCard:   { gap: Spacing.sm },
  catHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  catEmoji:  { fontSize: 24 },
  catInfo:   { flex: 1 },
  catName:   { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.text },
  catSpent:  { fontSize: Typography.xs, color: Colors.textSecondary },
  savingChip:{ fontSize: Typography.sm, fontWeight: Typography.bold, color: Colors.success, backgroundColor: Colors.success + '15', paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.full },

  stepperRow:   { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  stepBtn:      { width: 32, height: 32, borderRadius: Radius.full, backgroundColor: Colors.primary + '12', alignItems: 'center', justifyContent: 'center' },
  stepperTrack: { flex: 1, height: 8, borderRadius: Radius.full, backgroundColor: Colors.border, overflow: 'hidden' },
  stepperFill:  { height: 8, borderRadius: Radius.full, backgroundColor: Colors.primary },
  stepperValue: { width: 36, fontSize: Typography.sm, fontWeight: Typography.bold, color: Colors.primary, textAlign: 'right' },

  altToggle:     { flexDirection: 'row', alignItems: 'center', gap: 4, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.sm },
  altToggleText: { fontSize: Typography.sm, color: Colors.primary, fontWeight: Typography.medium },

  altList: { gap: Spacing.sm },
  altRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  altText: { flex: 1, fontSize: Typography.sm, color: Colors.text, lineHeight: 20 },

  summaryCard:     { borderRadius: Radius.xl, padding: Spacing.lg, alignItems: 'center', gap: Spacing.xs, ...Shadows.primary },
  summaryTitle:    { fontSize: Typography.sm, color: 'rgba(255,255,255,0.75)', fontWeight: Typography.medium },
  summaryAmount:   { fontSize: Typography.xxxl, fontWeight: Typography.bold, color: '#fff' },
  summarySubtitle: { fontSize: Typography.xs, color: 'rgba(255,255,255,0.65)', textAlign: 'center' },

  aiCoachBtn:   { borderRadius: Radius.xl, overflow: 'hidden', ...Shadows.lg },
  aiCoachInner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.base },
  aiCoachEmoji: { fontSize: 32 },
  aiCoachText:  { flex: 1 },
  aiCoachTitle: { fontSize: Typography.base, fontWeight: Typography.bold, color: '#fff' },
  aiCoachSub:   { fontSize: Typography.xs, color: 'rgba(255,255,255,0.7)', marginTop: 2, lineHeight: 18 },

  resetBtn:  { alignItems: 'center', paddingVertical: Spacing.sm },
  resetText: { fontSize: Typography.sm, color: Colors.danger, fontWeight: Typography.medium },
});
