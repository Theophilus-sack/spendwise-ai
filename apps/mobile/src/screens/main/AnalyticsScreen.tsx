import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView } from 'react-native';
import { Colors, Typography, Spacing } from '@/theme';
import { Card } from '@/components/ui';

// Victory Native charts are imported here in full implementation
// For now the screen is structured with placeholder chart areas
export function AnalyticsScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.placeholderChart}>
          <Text style={styles.chartTitle}>🍕 Spending by Category</Text>
          <Text style={styles.chartSub}>Pie chart — full implementation in Phase 3</Text>
        </Card>
        <Card style={styles.placeholderChart}>
          <Text style={styles.chartTitle}>📊 Budget vs Actual</Text>
          <Text style={styles.chartSub}>Bar chart — full implementation in Phase 3</Text>
        </Card>
        <Card style={styles.placeholderChart}>
          <Text style={styles.chartTitle}>📈 30-Day Spending Trend</Text>
          <Text style={styles.chartSub}>Area chart — full implementation in Phase 3</Text>
        </Card>
        <Card style={styles.placeholderChart}>
          <Text style={styles.chartTitle}>🗓️ Spending Heatmap</Text>
          <Text style={styles.chartSub}>K-Means trigger profiling — full implementation in Phase 3</Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:             { flex: 1, backgroundColor: Colors.background },
  content:          { padding: Spacing.base, gap: Spacing.base },
  placeholderChart: { height: 180, justifyContent: 'center', alignItems: 'center', gap: Spacing.sm },
  chartTitle:       { fontSize: Typography.base, fontWeight: Typography.bold, color: Colors.text },
  chartSub:         { fontSize: Typography.xs, color: Colors.textSecondary },
});
