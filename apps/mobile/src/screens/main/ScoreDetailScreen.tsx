import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card, ScoreRing, EmptyState } from '@/components/ui';
import { Colors, Typography, Spacing } from '@/theme';
import { FDS_WEIGHTS } from '@spendwise/shared';
import { useAuthStore } from '@/store/authStore';
import { useDisciplineStore } from '@/store/disciplineStore';

const COMPONENT_META = [
  { key: 'budgetAdherence', label: 'Budget Adherence', weight: FDS_WEIGHTS.budgetAdherence, desc: 'How many categories stayed under budget' },
  { key: 'savingsRate',     label: 'Savings Rate',     weight: FDS_WEIGHTS.savingsRate,     desc: 'Actual savings vs your target savings rate' },
  { key: 'consistency',     label: 'Consistency',      weight: FDS_WEIGHTS.consistency,     desc: 'Days with expenses logged out of total days' },
  { key: 'improvement',     label: 'Improvement',      weight: FDS_WEIGHTS.improvement,     desc: 'Progress compared to your last week score' },
] as const;

export function ScoreDetailScreen() {
  const user = useAuthStore(s => s.user);
  const { score, grade, components, commentary, loading, error, load } = useDisciplineStore();

  useEffect(() => {
    if (user) load(user.id);
  }, [user?.id]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.primary} size="large" />
          <Text style={styles.loadingText}>Calculating your discipline score…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (score === null || grade === null || components === null) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <EmptyState
            icon={<Ionicons name="shield-outline" size={28} color={Colors.primary} />}
            title="No score yet"
            description={error
              ? "We couldn't load your discipline score right now."
              : 'Log a few expenses and set up a budget this week — your score builds from there.'}
            action={user ? { label: 'Try again', onPress: () => load(user.id) } : undefined}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <ScoreRing score={score} grade={grade} size={120} strokeWidth={12} />
          <Text style={styles.heroTitle}>Financial Discipline Score</Text>
          <Text style={styles.heroSub}>
            {commentary || 'Log expenses and stick to your budgets to build your score.'}
          </Text>
        </View>

        <Card>
          <Text style={styles.componentTitle}>Score Components</Text>
          {COMPONENT_META.map(c => {
            const value = components[c.key];
            return (
              <View key={c.key} style={styles.component}>
                <View style={styles.componentHeader}>
                  <Text style={styles.componentName}>{c.label}</Text>
                  <View style={styles.componentValues}>
                    <Text style={styles.componentValue}>{Math.round(value * 100)}%</Text>
                    <Text style={styles.componentWeight}>weighted {(c.weight * 100).toFixed(0)}%</Text>
                  </View>
                </View>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${Math.round(value * 100)}%` }]} />
                </View>
                <Text style={styles.componentDesc}>{c.desc}</Text>
              </View>
            );
          })}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.base, gap: Spacing.base, alignItems: 'stretch' },
  centered:{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, padding: Spacing.xl },
  loadingText: { fontSize: Typography.sm, color: Colors.textSecondary, marginTop: Spacing.sm },
  hero:    { alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.lg },
  heroTitle: { fontSize: Typography.xl, fontWeight: Typography.bold, color: Colors.text, textAlign: 'center' },
  heroSub:   { fontSize: Typography.base, color: Colors.textSecondary, textAlign: 'center' },
  componentTitle:  { fontSize: Typography.base, fontWeight: Typography.bold, color: Colors.text, marginBottom: Spacing.md },
  component:       { paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  componentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  componentName:   { fontSize: Typography.base, fontWeight: Typography.medium, color: Colors.text },
  componentValues: { alignItems: 'flex-end' },
  componentValue:  { fontSize: Typography.base, color: Colors.primary, fontWeight: Typography.bold },
  componentWeight: { fontSize: Typography.xs, color: Colors.textTertiary },
  barTrack: { height: 4, borderRadius: 2, backgroundColor: Colors.border, marginTop: Spacing.xs, overflow: 'hidden' },
  barFill:  { height: '100%', backgroundColor: Colors.primary, borderRadius: 2 },
  componentDesc:   { fontSize: Typography.xs, color: Colors.textSecondary, marginTop: Spacing.xs },
});
