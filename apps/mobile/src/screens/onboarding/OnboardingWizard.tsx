import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/theme';
import {
  CURRENCIES, INCOME_RANGES, INCOME_SOURCES, ONBOARDING_GOALS,
  CATEGORIES, PAYMENT_METHODS, DEFAULT_BUDGET_PCT,
  SPENDING_PERSONALITIES, DISCIPLINE_STYLES,
} from '@spendwise/shared';
import type { OnboardingData, Currency, ExpenseCategory, PaymentMethod, IncomeSource } from '@spendwise/shared';

const TOTAL_STEPS = 7;

export function OnboardingWizard() {
  const { user, fetchProfile } = useAuthStore();
  const [step,    setStep]    = useState(0);
  const [loading, setLoading] = useState(false);

  const [data, setData] = useState<Partial<OnboardingData>>({
    currency: 'GHS',
    financialGoals: [],
    preferredCategories: [],
    preferredPaymentMethods: ['mobile_money'],
  });

  const update = (patch: Partial<OnboardingData>) => setData(d => ({ ...d, ...patch }));

  const toggleItem = <T extends string>(list: T[], item: T): T[] =>
    list.includes(item) ? list.filter(x => x !== item) : [...list, item];

  const canProceed = (): boolean => {
    switch (step) {
      case 0: return !!data.currency && !!data.incomeRange;
      case 1: return (data.incomeSources?.length ?? 0) > 0;
      case 2: return !!data.spendingPersonality && !!data.disciplineStyle;
      case 3: return (data.financialGoals?.length ?? 0) > 0;
      case 4: return (data.preferredCategories?.length ?? 0) > 0;
      case 5: return (data.preferredPaymentMethods?.length ?? 0) > 0;
      case 6: return true;
      default: return false;
    }
  };

  const handleFinish = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const incomeRange = INCOME_RANGES.find(r => r.value === data.incomeRange);
      const monthlyIncome = incomeRange?.midpoint ?? 0;

      // Starter budget from income and spending personality — a fixed formula,
      // not an AI call. Kept deterministic on purpose: budget math should be
      // auditable and instant, not dependent on a network round-trip during
      // account setup.
      const budgets = generateInitialBudgets(monthlyIncome, data.spendingPersonality ?? 'balanced');

      // Save profile
      const { error } = await supabase.from('profiles').upsert({
        user_id:                  user.id,
        full_name:                user.user_metadata.full_name ?? '',
        currency:                 data.currency,
        monthly_income:           monthlyIncome,
        income_sources:           data.incomeSources,
        spending_personality:     data.spendingPersonality,
        onboarding_goals:         data.financialGoals,
        preferred_categories:     data.preferredCategories,
        preferred_payment_methods: data.preferredPaymentMethods,
        discipline_style:         data.disciplineStyle,
        savings_target_pct:       data.spendingPersonality === 'saver' ? 30 : 20,
        onboarding_completed:     true,
      }, { onConflict: 'user_id' });

      if (error) throw error;

      // Save the starter budgets (ignore if already exist)
      for (const budget of budgets) {
        await supabase.from('budgets').upsert({
          user_id:      user.id,
          category:     budget.category,
          limit_amount: budget.limit,
          period:       'monthly',
          ai_suggested: false,
        }, { onConflict: 'user_id,category,period' });
      }

      await fetchProfile();
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Could not save your profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Progress bar */}
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${((step + 1) / TOTAL_STEPS) * 100}%` }]} />
      </View>

      {/* Back button */}
      {step > 0 && (
        <TouchableOpacity style={styles.backBtn} onPress={() => setStep(s => s - 1)}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
      )}

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* ── Step 0: Currency & Income ── */}
        {step === 0 && (
          <StepWrapper
            emoji="💰" title="Let's get started"
            subtitle="Tell us about your finances so we can build a personalised plan."
          >
            <Label text="Your currency" />
            <ChipGrid>
              {Object.entries(CURRENCIES).map(([code, { symbol, name }]) => (
                <Chip
                  key={code}
                  label={`${symbol} ${code}`}
                  selected={data.currency === code}
                  onPress={() => update({ currency: code as Currency })}
                />
              ))}
            </ChipGrid>

            <Label text="Monthly income range" />
            <ChipGrid>
              {INCOME_RANGES.map(r => (
                <Chip
                  key={r.value}
                  label={r.label}
                  selected={data.incomeRange === r.value}
                  onPress={() => update({ incomeRange: r.value })}
                  fullWidth
                />
              ))}
            </ChipGrid>
          </StepWrapper>
        )}

        {/* ── Step 1: Income Sources ── */}
        {step === 1 && (
          <StepWrapper
            emoji="💼" title="Where does your money come from?"
            subtitle="Select all that apply."
          >
            <ChipGrid>
              {Object.entries(INCOME_SOURCES).map(([id, { label, emoji }]) => (
                <Chip
                  key={id}
                  label={`${emoji} ${label}`}
                  selected={(data.incomeSources ?? []).includes(id as IncomeSource)}
                  onPress={() => update({ incomeSources: toggleItem(data.incomeSources ?? [], id as IncomeSource) })}
                />
              ))}
            </ChipGrid>
          </StepWrapper>
        )}

        {/* ── Step 2: Personality & Discipline ── */}
        {step === 2 && (
          <StepWrapper
            emoji="🧠" title="How do you handle money?"
            subtitle="Be honest — this shapes your AI recommendations."
          >
            <Label text="Spending personality" />
            {SPENDING_PERSONALITIES.map(p => (
              <PersonalityCard
                key={p.id} emoji={p.emoji} label={p.label} desc={p.desc}
                selected={data.spendingPersonality === p.id}
                onPress={() => update({ spendingPersonality: p.id })}
              />
            ))}
            <Label text="Discipline style" />
            {DISCIPLINE_STYLES.map(d => (
              <PersonalityCard
                key={d.id} emoji={d.emoji} label={d.label} desc={d.desc}
                selected={data.disciplineStyle === d.id}
                onPress={() => update({ disciplineStyle: d.id })}
              />
            ))}
          </StepWrapper>
        )}

        {/* ── Step 3: Financial Goals ── */}
        {step === 3 && (
          <StepWrapper
            emoji="🎯" title="What are your financial goals?"
            subtitle="Pick all that apply — we'll tailor your AI advisor to these."
          >
            <ChipGrid>
              {ONBOARDING_GOALS.map(g => (
                <Chip
                  key={g.id}
                  label={`${g.emoji} ${g.label}`}
                  selected={(data.financialGoals ?? []).includes(g.id)}
                  onPress={() => update({ financialGoals: toggleItem(data.financialGoals ?? [], g.id) })}
                  fullWidth
                />
              ))}
            </ChipGrid>
          </StepWrapper>
        )}

        {/* ── Step 4: Spending Categories ── */}
        {step === 4 && (
          <StepWrapper
            emoji="🛒" title="Your top spending areas?"
            subtitle="These become your budget categories."
          >
            <ChipGrid>
              {Object.entries(CATEGORIES).filter(([k]) => k !== 'savings').map(([id, { label, emoji }]) => (
                <Chip
                  key={id}
                  label={`${emoji} ${label}`}
                  selected={(data.preferredCategories ?? []).includes(id as ExpenseCategory)}
                  onPress={() => update({ preferredCategories: toggleItem(data.preferredCategories ?? [], id as ExpenseCategory) })}
                />
              ))}
            </ChipGrid>
          </StepWrapper>
        )}

        {/* ── Step 5: Payment Methods ── */}
        {step === 5 && (
          <StepWrapper
            emoji="💳" title="How do you usually pay?"
            subtitle="We'll use this to make logging faster."
          >
            <ChipGrid>
              {Object.entries(PAYMENT_METHODS).map(([id, { label, emoji }]) => (
                <Chip
                  key={id}
                  label={`${emoji} ${label}`}
                  selected={(data.preferredPaymentMethods ?? []).includes(id as PaymentMethod)}
                  onPress={() => update({ preferredPaymentMethods: toggleItem(data.preferredPaymentMethods ?? [], id as PaymentMethod) })}
                />
              ))}
            </ChipGrid>
          </StepWrapper>
        )}

        {/* ── Step 6: All done ── */}
        {step === 6 && (
          <StepWrapper
            emoji="🎉" title="You're all set!"
            subtitle="We've built your starter budget from your income and habits. Let's start tracking."
          >
            <View style={styles.doneCard}>
              <Text style={styles.doneText}>✅ Starter budget created from your income</Text>
              <Text style={styles.doneText}>✅ Your AI advisor is ready to chat</Text>
              <Text style={styles.doneText}>✅ Financial Discipline Score will start tracking</Text>
              <Text style={styles.doneText}>✅ Spending forecast ready once you log a few expenses</Text>
            </View>
          </StepWrapper>
        )}

      </ScrollView>

      {/* CTA */}
      <View style={styles.footer}>
        <Button
          label={step === TOTAL_STEPS - 1 ? 'Launch SpendWise AI 🚀' : 'Continue'}
          onPress={step === TOTAL_STEPS - 1 ? handleFinish : () => setStep(s => s + 1)}
          disabled={!canProceed()}
          loading={loading}
          fullWidth size="lg"
        />
        <Text style={styles.stepCount}>{step + 1} of {TOTAL_STEPS}</Text>
      </View>
    </SafeAreaView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepWrapper({ emoji, title, subtitle, children }: {
  emoji: string; title: string; subtitle: string; children: React.ReactNode;
}) {
  return (
    <View style={styles.stepWrapper}>
      <Text style={styles.stepEmoji}>{emoji}</Text>
      <Text style={styles.stepTitle}>{title}</Text>
      <Text style={styles.stepSubtitle}>{subtitle}</Text>
      <View style={styles.stepContent}>{children}</View>
    </View>
  );
}

function Label({ text }: { text: string }) {
  return <Text style={styles.label}>{text}</Text>;
}

function ChipGrid({ children }: { children: React.ReactNode }) {
  return <View style={styles.chipGrid}>{children}</View>;
}

function Chip({ label, selected, onPress, fullWidth }: {
  label: string; selected: boolean; onPress: () => void; fullWidth?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected, fullWidth && styles.chipFull]}
      activeOpacity={0.8}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

function PersonalityCard({ emoji, label, desc, selected, onPress }: {
  emoji: string; label: string; desc: string; selected: boolean; onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.personalityCard, selected && styles.personalityCardSelected]}
      activeOpacity={0.8}
    >
      <Text style={styles.personalityEmoji}>{emoji}</Text>
      <View style={styles.personalityText}>
        <Text style={[styles.personalityLabel, selected && { color: Colors.primary }]}>{label}</Text>
        <Text style={styles.personalityDesc}>{desc}</Text>
      </View>
      {selected && <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />}
    </TouchableOpacity>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateInitialBudgets(monthlyIncome: number, personality: string) {
  const multiplier = personality === 'saver' ? 0.8 : personality === 'spender' ? 1.1 : 1.0;
  return Object.entries(DEFAULT_BUDGET_PCT)
    .filter(([, pct]) => pct > 0)
    .map(([category, pct]) => ({
      category,
      limit: Math.round(monthlyIncome * pct * multiplier / 10) * 10, // round to nearest 10
    }));
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: Colors.background },
  progressBar: { height: 4, backgroundColor: Colors.border },
  progressFill:{ height: 4, backgroundColor: Colors.primary, borderRadius: Radius.full },
  backBtn:     { padding: Spacing.base, position: 'absolute', top: 56, left: Spacing.sm, zIndex: 10 },
  content:     { padding: Spacing.lg, paddingTop: Spacing.xl, paddingBottom: Spacing.xxxl },
  footer:      { padding: Spacing.base, gap: Spacing.sm, backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.border },
  stepCount:   { textAlign: 'center', fontSize: Typography.xs, color: Colors.textTertiary },

  stepWrapper:  { gap: Spacing.lg },
  stepEmoji:    { fontSize: 52, textAlign: 'center' },
  stepTitle:    { fontSize: Typography.xl, fontWeight: Typography.bold, color: Colors.text, textAlign: 'center' },
  stepSubtitle: { fontSize: Typography.base, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  stepContent:  { gap: Spacing.md },

  label: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },

  chipGrid:         { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip:             { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surface },
  chipSelected:     { borderColor: Colors.primary, backgroundColor: Colors.primary + '18' },
  chipText:         { fontSize: Typography.sm, color: Colors.textSecondary, fontWeight: Typography.medium },
  chipTextSelected: { color: Colors.primary, fontWeight: Typography.semibold },
  chipFull:         { width: '100%' },

  personalityCard:         { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.base, backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1.5, borderColor: Colors.border, ...Shadows.sm },
  personalityCardSelected: { borderColor: Colors.primary, backgroundColor: Colors.primary + '08' },
  personalityEmoji:        { fontSize: 28 },
  personalityText:         { flex: 1 },
  personalityLabel:        { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.text },
  personalityDesc:         { fontSize: Typography.sm, color: Colors.textSecondary },

  doneCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.md, ...Shadows.sm },
  doneText: { fontSize: Typography.base, color: Colors.text, fontWeight: Typography.medium },
});
