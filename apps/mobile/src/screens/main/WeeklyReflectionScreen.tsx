import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '@/store/authStore';
import { useExpenseStore } from '@/store/expenseStore';
import { useBudgetStore } from '@/store/budgetStore';
import { useDisciplineStore } from '@/store/disciplineStore';
import { useWeeklyReflectionStore } from '@/store/weeklyReflectionStore';
import type { FollowThrough, SubmitReflectionResult } from '@/store/weeklyReflectionStore';
import { Card, Button, Chip } from '@/components/ui';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/theme';
import { CATEGORY_LIST, getCategoryEmoji, getCategoryLabel, SPENDING_ALTERNATIVES, formatCurrency } from '@spendwise/shared';
import type { AppStackNavProp } from '@/navigation/types';

const MOODS = [
  { value: 1, emoji: '😞' },
  { value: 2, emoji: '😕' },
  { value: 3, emoji: '😐' },
  { value: 4, emoji: '🙂' },
  { value: 5, emoji: '😄' },
];

export function WeeklyReflectionScreen() {
  const nav = useNavigation<AppStackNavProp>();
  const user = useAuthStore(s => s.user);
  const profile = useAuthStore(s => s.profile);
  const currency = profile?.currency ?? 'GHS';

  const expenses = useExpenseStore(s => s.expenses);
  const getBudgetStatuses = useExpenseStore(s => s.getBudgetStatuses);
  const budgets = useBudgetStore(s => s.budgets);
  const upsertBudget = useBudgetStore(s => s.upsertBudget);

  const { score, grade, trend } = useDisciplineStore();
  const { current, previous, streak, submitting, load, submit } = useWeeklyReflectionStore();

  useEffect(() => { if (user) load(user.id); }, [user?.id]);

  // Auto-detect the worst over-budget category as a starting point — the
  // user confirms or overrides it, rather than picking from a blank slate.
  const statuses = useMemo(
    () => [...getBudgetStatuses(budgets)].sort((a, b) => b.percentage - a.percentage),
    [expenses, budgets],
  );
  const detectedOverBudget = statuses.find(s => s.isOver);

  const [exceededCategory, setExceededCategory] = useState<string | null>('__unset__');
  const [adjustNextWeek, setAdjustNextWeek] = useState<boolean | null>(null);
  const [quickAdjustInput, setQuickAdjustInput] = useState('');
  const [smallChange, setSmallChange] = useState('');
  const [moodRating, setMoodRating] = useState(3);
  const [followThrough, setFollowThrough] = useState<FollowThrough | null>(null);
  const [result, setResult] = useState<SubmitReflectionResult | null>(null);

  // Pre-fill from whatever's already saved for this week (editable, not locked).
  useEffect(() => {
    if (current) {
      setExceededCategory(current.exceededCategory);
      setAdjustNextWeek(current.adjustNextWeek);
      setSmallChange(current.smallChange);
      setMoodRating(current.moodRating);
      setFollowThrough(current.followThrough);
    } else if (exceededCategory === '__unset__') {
      setExceededCategory(detectedOverBudget?.category ?? null);
    }
  }, [current, detectedOverBudget?.category]);

  const showFollowThroughPrompt = !!previous?.smallChange && !current;
  const suggestions = exceededCategory ? SPENDING_ALTERNATIVES[exceededCategory as keyof typeof SPENDING_ALTERNATIVES] : undefined;
  const exceededStatus = exceededCategory ? statuses.find(s => s.category === exceededCategory) : undefined;

  const scoreContext = () => {
    if (score === null) return "Let's build your first week of data.";
    const gradeText = `${score}/100 · Grade ${grade}`;
    if (trend === 'improving') return `${gradeText} — trending up from last week`;
    if (trend === 'declining') return `${gradeText} — a bit softer than last week`;
    return `${gradeText} — holding steady`;
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (!smallChange.trim()) {
      Alert.alert('One more thing', "What's one specific thing you'll try next week?");
      return;
    }
    try {
      if (adjustNextWeek && exceededCategory && quickAdjustInput.trim() && exceededStatus) {
        const newLimit = parseFloat(quickAdjustInput);
        if (!isNaN(newLimit) && newLimit > 0) {
          await upsertBudget({ ...exceededStatus, limitAmount: newLimit, updatedAt: new Date().toISOString() });
        }
      }

      const res = await submit(user.id, {
        exceededCategory,
        adjustNextWeek: adjustNextWeek ?? false,
        smallChange: smallChange.trim(),
        moodRating,
        followThrough: showFollowThroughPrompt && followThrough ? followThrough : undefined,
      });
      setResult(res);
    } catch (err) {
      Alert.alert('Could not save', err instanceof Error ? err.message : 'Please try again.');
    }
  };

  if (result) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.resultContent}>
          <View style={styles.resultIconBg}>
            <Ionicons name="checkmark-circle" size={40} color={Colors.success} />
          </View>
          <Text style={styles.resultTitle}>Reflection saved</Text>
          {result.reflectionBonus > 0 && (
            <View style={styles.bonusChip}>
              <Text style={styles.bonusChipText}>+{result.reflectionBonus} points for reflecting</Text>
            </View>
          )}
          <Card style={styles.resultScoreCard}>
            <Text style={styles.resultScoreValue}>{result.score}/100</Text>
            <Text style={styles.resultScoreGrade}>Grade {result.grade}</Text>
          </Card>
          <Card style={styles.aiCard}>
            <Text style={styles.aiLabel}>Your coach says</Text>
            <Text style={styles.aiText}>{result.aiResponse}</Text>
          </Card>
          <Button label="Done" onPress={() => nav.goBack()} fullWidth size="lg" />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Weekly Reflection</Text>
            <Text style={styles.headerSub}>A 2-minute check-in, built from your real week.</Text>
          </View>
          {streak > 0 && (
            <View style={styles.streakChip}>
              <Ionicons name="flame" size={12} color={Colors.accentDark} />
              <Text style={styles.streakChipText}>{streak}-week streak</Text>
            </View>
          )}
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Card style={styles.scoreCard}>
            <Text style={styles.scoreCardText}>{scoreContext()}</Text>
          </Card>

          {showFollowThroughPrompt && (
            <Card style={styles.followCard}>
              <Text style={styles.fieldLabel}>Last week you planned to:</Text>
              <Text style={styles.previousPlan}>"{previous!.smallChange}"</Text>
              <Text style={[styles.fieldLabel, { marginTop: Spacing.sm }]}>How did it go?</Text>
              <View style={styles.chipRow}>
                {(['yes', 'partially', 'no'] as FollowThrough[]).map(v => (
                  <Chip
                    key={v}
                    label={v === 'yes' ? 'Yes' : v === 'partially' ? 'Partially' : 'No'}
                    active={followThrough === v}
                    onPress={() => setFollowThrough(v)}
                    style={styles.equalChip}
                  />
                ))}
              </View>
            </Card>
          )}

          <Card style={styles.card}>
            <Text style={styles.questionNum}>1. Which category gave you the most trouble this week?</Text>
            <View style={styles.chipGrid}>
              <TouchableOpacity
                style={[styles.catChip, exceededCategory === null && styles.chipActive]}
                onPress={() => setExceededCategory(null)}
              >
                <Text style={[styles.chipText, exceededCategory === null && styles.chipTextActive]}>None</Text>
              </TouchableOpacity>
              {CATEGORY_LIST.map(cat => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.catChip, exceededCategory === cat && styles.chipActive]}
                  onPress={() => setExceededCategory(cat)}
                >
                  <Text style={styles.chipEmoji}>{getCategoryEmoji(cat)}</Text>
                  <Text style={[styles.chipText, exceededCategory === cat && styles.chipTextActive]}>{getCategoryLabel(cat)}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {detectedOverBudget && exceededCategory === detectedOverBudget.category && (
              <Text style={styles.detectedNote}>
                Pre-selected — you spent {formatCurrency(detectedOverBudget.spent, currency)} of your {formatCurrency(detectedOverBudget.limitAmount, currency)} budget here.
              </Text>
            )}
          </Card>

          {exceededCategory && (
            <Card style={styles.card}>
              <Text style={styles.questionNum}>2. Want to adjust your {getCategoryLabel(exceededCategory as any)} budget for next week?</Text>
              <View style={styles.chipRow}>
                <Chip
                  label="Yes, adjust"
                  active={adjustNextWeek === true}
                  onPress={() => setAdjustNextWeek(true)}
                  style={styles.equalChip}
                />
                <Chip
                  label="Keep the same"
                  active={adjustNextWeek === false}
                  onPress={() => setAdjustNextWeek(false)}
                  style={styles.equalChip}
                />
              </View>
              {adjustNextWeek && exceededStatus && (
                <View style={styles.quickAdjust}>
                  <Text style={styles.fieldLabel}>New monthly limit ({currency === 'GHS' ? '₵' : currency})</Text>
                  <TextInput
                    style={styles.input}
                    value={quickAdjustInput}
                    onChangeText={setQuickAdjustInput}
                    placeholder={`Currently ${exceededStatus.limitAmount.toFixed(0)}`}
                    placeholderTextColor={Colors.textTertiary}
                    keyboardType="decimal-pad"
                  />
                </View>
              )}
            </Card>
          )}

          <Card style={styles.card}>
            <Text style={styles.questionNum}>3. What's one specific thing you'll try next week?</Text>
            {suggestions && suggestions.length > 0 && (
              <View style={styles.suggestRow}>
                {suggestions.map(s => (
                  <TouchableOpacity key={s} style={styles.suggestChip} onPress={() => setSmallChange(s)}>
                    <Text style={styles.suggestChipText}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <TextInput
              style={styles.textArea}
              value={smallChange}
              onChangeText={setSmallChange}
              placeholder="e.g. Cook at home 3 days, reduce Bolt rides..."
              placeholderTextColor={Colors.textTertiary}
              multiline
            />
            {exceededCategory && (
              <TouchableOpacity
                style={styles.aiLink}
                onPress={() => nav.navigate('AIAdvisor', {
                  initialMessage: `I went over budget on ${exceededCategory} this week (spent ${exceededStatus ? formatCurrency(exceededStatus.spent, currency) : 'more than planned'}). What's one specific, realistic change I could make next week?`,
                })}
              >
                <Ionicons name="sparkles-outline" size={14} color={Colors.primary} />
                <Text style={styles.aiLinkText}>Ask AI Coach for more ideas</Text>
              </TouchableOpacity>
            )}
          </Card>

          <Card style={styles.card}>
            <Text style={styles.questionNum}>How are you feeling about your finances this week?</Text>
            <View style={styles.moodRow}>
              {MOODS.map(m => (
                <TouchableOpacity
                  key={m.value}
                  style={[styles.moodBtn, moodRating === m.value && styles.moodBtnActive]}
                  onPress={() => setMoodRating(m.value)}
                >
                  <Text style={styles.moodEmoji}>{m.emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Card>

          <Button label="Save Reflection" onPress={handleSubmit} loading={submitting} fullWidth size="lg" />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: Spacing.base, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerTitle: { fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.text },
  headerSub:   { fontSize: Typography.xs, color: Colors.textSecondary, marginTop: 2 },
  streakChip:  { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.accent + '18', borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 4 },
  streakChipText: { fontSize: Typography.xs, fontWeight: Typography.bold, color: Colors.accentDark },

  content: { padding: Spacing.base, gap: Spacing.base, paddingBottom: Spacing.xxxl },

  scoreCard: { backgroundColor: Colors.primary + '0A', borderWidth: 1, borderColor: Colors.primary + '30' },
  scoreCardText: { fontSize: Typography.base, fontWeight: Typography.medium, color: Colors.text },

  followCard: { gap: Spacing.xs, backgroundColor: Colors.accent + '0A', borderWidth: 1, borderColor: Colors.accent + '30' },
  previousPlan: { fontSize: Typography.base, fontStyle: 'italic', color: Colors.text },

  card: { gap: Spacing.sm },
  questionNum: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.text },
  fieldLabel:  { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.textSecondary },

  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chipRow:  { flexDirection: 'row', gap: Spacing.sm },
  catChip:  { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surfaceAlt },
  chipActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '18' },
  equalChip: { flex: 1 },
  chipEmoji: { fontSize: 14 },
  chipText:  { fontSize: Typography.sm, color: Colors.textSecondary, fontWeight: Typography.medium },
  chipTextActive: { color: Colors.primary, fontWeight: Typography.semibold },
  detectedNote: { fontSize: Typography.xs, color: Colors.textTertiary, fontStyle: 'italic' },

  quickAdjust: { gap: Spacing.xs, marginTop: Spacing.xs },
  input: { backgroundColor: Colors.surfaceAlt, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border, padding: Spacing.sm, fontSize: Typography.base, color: Colors.text },

  suggestRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  suggestChip: { backgroundColor: Colors.primary + '10', borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 4 },
  suggestChipText: { fontSize: Typography.xs, color: Colors.primary, fontWeight: Typography.medium },

  textArea: { backgroundColor: Colors.surfaceAlt, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border, padding: Spacing.sm, fontSize: Typography.base, color: Colors.text, minHeight: 70, textAlignVertical: 'top' },

  aiLink: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
  aiLinkText: { fontSize: Typography.xs, color: Colors.primary, fontWeight: Typography.medium },

  moodRow: { flexDirection: 'row', justifyContent: 'space-between' },
  moodBtn: { width: 48, height: 48, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surfaceAlt },
  moodBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '18' },
  moodEmoji: { fontSize: 22 },

  // Result view
  resultContent: { padding: Spacing.xl, alignItems: 'center', gap: Spacing.md, paddingTop: Spacing.xxxl },
  resultIconBg: { width: 72, height: 72, borderRadius: Radius.full, backgroundColor: Colors.success + '12', alignItems: 'center', justifyContent: 'center' },
  resultTitle: { fontSize: Typography.xl, fontWeight: Typography.bold, color: Colors.text },
  bonusChip: { backgroundColor: Colors.success + '18', borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs },
  bonusChipText: { fontSize: Typography.sm, fontWeight: Typography.bold, color: Colors.success },
  resultScoreCard: { alignItems: 'center', gap: 2, width: '100%' },
  resultScoreValue: { fontSize: Typography.xxxl, fontWeight: Typography.bold, color: Colors.text },
  resultScoreGrade: { fontSize: Typography.sm, color: Colors.textSecondary },
  aiCard: { width: '100%', gap: 4, backgroundColor: Colors.primary + '08', ...Shadows.sm },
  aiLabel: { fontSize: Typography.xs, fontWeight: Typography.bold, color: Colors.primary, textTransform: 'uppercase', letterSpacing: 0.5 },
  aiText: { fontSize: Typography.base, color: Colors.text, lineHeight: 22 },
});
