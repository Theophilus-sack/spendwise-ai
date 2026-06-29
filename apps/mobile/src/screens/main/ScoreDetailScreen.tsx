import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView } from 'react-native';
import { Card, ScoreRing } from '@/components/ui';
import { Colors, Typography, Spacing } from '@/theme';
import { FDS_WEIGHTS } from '@spendwise/shared';

export function ScoreDetailScreen() {
  // Placeholder — will load from discipline_scores table in Phase 2
  const score = 0;
  const grade: 'F' = 'F';

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <ScoreRing score={score} grade={grade} size={120} strokeWidth={12} />
          <Text style={styles.heroTitle}>Financial Discipline Score</Text>
          <Text style={styles.heroSub}>Log expenses and stick to your budgets to build your score.</Text>
        </View>

        <Card>
          <Text style={styles.componentTitle}>Score Components</Text>
          {[
            { label: 'Budget Adherence', key: 'budgetAdherence', weight: FDS_WEIGHTS.budgetAdherence, desc: 'How many categories stayed under budget' },
            { label: 'Savings Rate',     key: 'savingsRate',     weight: FDS_WEIGHTS.savingsRate,     desc: 'Actual savings vs your target savings rate' },
            { label: 'Consistency',      key: 'consistency',     weight: FDS_WEIGHTS.consistency,     desc: 'Days with expenses logged out of total days' },
            { label: 'Improvement',      key: 'improvement',     weight: FDS_WEIGHTS.improvement,     desc: 'Progress compared to your last week score' },
          ].map(c => (
            <View key={c.key} style={styles.component}>
              <View style={styles.componentHeader}>
                <Text style={styles.componentName}>{c.label}</Text>
                <Text style={styles.componentWeight}>{(c.weight * 100).toFixed(0)}%</Text>
              </View>
              <Text style={styles.componentDesc}>{c.desc}</Text>
            </View>
          ))}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.base, gap: Spacing.base, alignItems: 'stretch' },
  hero:    { alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.lg },
  heroTitle: { fontSize: Typography.xl, fontWeight: Typography.bold, color: Colors.text },
  heroSub:   { fontSize: Typography.base, color: Colors.textSecondary, textAlign: 'center' },
  componentTitle:  { fontSize: Typography.base, fontWeight: Typography.bold, color: Colors.text, marginBottom: Spacing.md },
  component:       { paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  componentHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  componentName:   { fontSize: Typography.base, fontWeight: Typography.medium, color: Colors.text },
  componentWeight: { fontSize: Typography.sm, color: Colors.primary, fontWeight: Typography.bold },
  componentDesc:   { fontSize: Typography.xs, color: Colors.textSecondary, marginTop: 2 },
});
