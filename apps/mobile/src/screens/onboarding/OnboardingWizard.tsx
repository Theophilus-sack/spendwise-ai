import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/theme';
import {
  CURRENCIES, INCOME_RANGES, INCOME_SOURCES, ONBOARDING_GOALS,
  CATEGORIES, PAYMENT_METHODS, SAVINGS_PCT_OPTIONS,
  SPENDING_PERSONALITIES, DISCIPLINE_STYLES, formatCurrency,
  generateIncomeBasedBudgets,
} from '@spendwise/shared';
import type { OnboardingData, Currency, ExpenseCategory, PaymentMethod, IncomeSource } from '@spendwise/shared';

const TOTAL_STEPS = 8;

export function OnboardingWizard() {
  const { user, fetchProfile } = useAuthStore();
  const [step,    setStep]    = useState(0);
  const [loading, setLoading] = useState(false);

  const [data, setData] = useState<Partial<OnboardingData>>({
    currency: 'GHS',
    savingsTargetPct: 0.20,
    financialGoals: [],
    preferredCategories: [],
    preferredPaymentMethods: ['mobile_money'],
  });

  const update = (patch: Partial<OnboardingData>) => setData(d => ({ ...d, ...patch }));

  // Every step except the final summary can be skipped — most of what's
  // collected here (income sources, goals, categories, payment methods)
  // isn't read anywhere outside this wizard yet, and the rest already has
  // safe fallback defaults. Only income (step 0) actually degrades the
  // experience if left unset, so that's the one skip that warns first.
  const handleSkip = () => {
    if (step === 0) {
      Alert.alert(
        'Skip for now?',
        `You can add your income anytime from Settings. Until then, your starter budget will show ${formatCurrency(0, data.currency ?? 'GHS')} limits.`,
        [
          { text: 'Go back', style: 'cancel' },
          { text: 'Skip', onPress: () => setStep(s => s + 1) },
        ],
      );
      return;
    }
    setStep(s => s + 1);
  };

  const toggleItem = <T extends string>(list: T[], item: T): T[] =>
    list.includes(item) ? list.filter(x => x !== item) : [...list, item];

  const canProceed = (): boolean => {
    switch (step) {
      case 0: return !!data.currency && !!data.incomeRange;
      case 1: return data.savingsTargetPct != null;
      case 2: return (data.incomeSources?.length ?? 0) > 0;
      case 3: return !!data.spendingPersonality && !!data.disciplineStyle;
      case 4: return (data.financialGoals?.length ?? 0) > 0;
      case 5: return (data.preferredCategories?.length ?? 0) > 0;
      case 6: return (data.preferredPaymentMethods?.length ?? 0) > 0;
      case 7: return true;
      default: return false;
    }
  };

  const handleFinish = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const incomeRange = INCOME_RANGES.find(r => r.value === data.incomeRange);
      const monthlyIncome = incomeRange?.midpoint ?? 0;
      const savingsTargetPct = data.savingsTargetPct ?? 0.20;

      // Starter budget from income, the user's own chosen savings rate, and
      // spending personality — a fixed formula, not an AI call. Kept
      // deterministic on purpose: budget math should be auditable and
      // instant, not dependent on a network round-trip during account setup.
      // Every category's limit (including savings) always sums back to
      // exactly `monthlyIncome` — the budget tallies with income by
      // construction, not by coincidence.
      const budgets = generateIncomeBasedBudgets(monthlyIncome, savingsTargetPct, data.spendingPersonality ?? 'balanced');

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
        savings_target_pct:       Math.round(savingsTargetPct * 100),
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
            icon="wallet-outline" title="Let's get started"
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

        {/* ── Step 1: Savings Goal ── */}
        {step === 1 && (
          <StepWrapper
            icon="trending-up-outline" title="How much do you want to save?"
            subtitle="We'll build your starter budget around this — the rest of your income gets split across your everyday categories."
          >
            <ChipGrid>
              {SAVINGS_PCT_OPTIONS.map(pct => {
                const incomeRange = INCOME_RANGES.find(r => r.value === data.incomeRange);
                const estIncome = incomeRange?.midpoint ?? 0;
                return (
                  <Chip
                    key={pct}
                    label={`${Math.round(pct * 100)}%${estIncome > 0 ? ` · ${formatCurrency(estIncome * pct, data.currency ?? 'GHS')}/mo` : ''}`}
                    selected={data.savingsTargetPct === pct}
                    onPress={() => update({ savingsTargetPct: pct })}
                    fullWidth
                  />
                );
              })}
            </ChipGrid>
          </StepWrapper>
        )}

        {/* ── Step 2: Income Sources ── */}
        {step === 2 && (
          <StepWrapper
            icon="briefcase-outline" title="Where does your money come from?"
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

        {/* ── Step 3: Personality & Discipline ── */}
        {step === 3 && (
          <StepWrapper
            icon="options-outline" title="How do you handle money?"
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

        {/* ── Step 4: Financial Goals ── */}
        {step === 4 && (
          <StepWrapper
            icon="flag-outline" title="What are your financial goals?"
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

        {/* ── Step 5: Spending Categories ── */}
        {step === 5 && (
          <StepWrapper
            icon="cart-outline" title="Your top spending areas?"
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

        {/* ── Step 6: Payment Methods ── */}
        {step === 6 && (
          <StepWrapper
            icon="card-outline" title="How do you usually pay?"
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

        {/* ── Step 7: All done ── */}
        {step === 7 && (
          <StepWrapper
            icon="checkmark-circle-outline" title="You're all set!"
            subtitle="We've built your starter budget from your income and habits. Let's start tracking."
          >
            <View style={styles.doneCard}>
              {[
                'Starter budget created from your income',
                'Your AI advisor is ready to chat',
                'Financial Discipline Score will start tracking',
                'Spending forecast ready once you log a few expenses',
              ].map(line => (
                <View key={line} style={styles.doneRow}>
                  <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
                  <Text style={styles.doneText}>{line}</Text>
                </View>
              ))}
            </View>
          </StepWrapper>
        )}

      </ScrollView>

      {/* CTA */}
      <View style={styles.footer}>
        <Button
          label={step === TOTAL_STEPS - 1 ? 'Launch SpendWise AI' : 'Continue'}
          onPress={step === TOTAL_STEPS - 1 ? handleFinish : () => setStep(s => s + 1)}
          disabled={!canProceed()}
          loading={loading}
          fullWidth size="lg"
        />
        {step < TOTAL_STEPS - 1 && (
          <TouchableOpacity onPress={handleSkip} hitSlop={8}>
            <Text style={styles.skipText}>Skip for now</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.stepCount}>{step + 1} of {TOTAL_STEPS}</Text>
      </View>
    </SafeAreaView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepWrapper({ icon, title, subtitle, children }: {
  icon: keyof typeof Ionicons.glyphMap; title: string; subtitle: string; children: React.ReactNode;
}) {
  return (
    <View style={styles.stepWrapper}>
      <View style={styles.stepIconBg}>
        <Ionicons name={icon} size={32} color={Colors.primary} />
      </View>
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


// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: Colors.background },
  progressBar: { height: 4, backgroundColor: Colors.border },
  progressFill:{ height: 4, backgroundColor: Colors.primary, borderRadius: Radius.full },
  backBtn:     { padding: Spacing.base, position: 'absolute', top: 56, left: Spacing.sm, zIndex: 10 },
  content:     { padding: Spacing.lg, paddingTop: Spacing.xl, paddingBottom: Spacing.xxxl },
  footer:      { padding: Spacing.base, gap: Spacing.sm, backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.border },
  stepCount:   { textAlign: 'center', fontSize: Typography.xs, color: Colors.textTertiary },
  skipText:    { textAlign: 'center', fontSize: Typography.sm, color: Colors.textTertiary, fontWeight: Typography.medium, paddingTop: Spacing.xs },

  stepWrapper:  { gap: Spacing.lg },
  stepIconBg:   { width: 72, height: 72, borderRadius: Radius.full, backgroundColor: Colors.primary + '12', alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
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
  doneRow:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  doneText: { flex: 1, fontSize: Typography.base, color: Colors.text, fontWeight: Typography.medium },
});
