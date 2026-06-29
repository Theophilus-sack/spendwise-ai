import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import { Colors, Typography, Spacing } from '@/theme';

export function IncomeScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.center}>
        <Text style={styles.emoji}>💼</Text>
        <Text style={styles.title}>Income Tracker</Text>
        <Text style={styles.sub}>Track multiple income sources with recurring flags — full implementation in Phase 2.</Text>
      </View>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, gap: Spacing.md },
  emoji:  { fontSize: 64 },
  title:  { fontSize: Typography.xl, fontWeight: Typography.bold, color: Colors.text },
  sub:    { fontSize: Typography.base, color: Colors.textSecondary, textAlign: 'center' },
});
