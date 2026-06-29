import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList } from 'react-native';
import { Card } from '@/components/ui';
import { Colors, Typography, Spacing, Radius } from '@/theme';
import { BADGES } from '@spendwise/shared';

export function AchievementsScreen() {
  const badgeList = Object.values(BADGES);

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        data={badgeList}
        keyExtractor={b => b.id}
        numColumns={2}
        contentContainerStyle={styles.list}
        columnWrapperStyle={styles.row}
        renderItem={({ item: badge }) => (
          <Card style={[styles.badge, styles.badgeLocked]}>
            <Text style={[styles.badgeEmoji, styles.emojiLocked]}>{badge.emoji}</Text>
            <Text style={styles.badgeName}>{badge.name}</Text>
            <Text style={styles.badgeDesc} numberOfLines={2}>{badge.description}</Text>
            <View style={styles.lockedTag}>
              <Text style={styles.lockedText}>Locked</Text>
            </View>
          </Card>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: Colors.background },
  list:         { padding: Spacing.base, gap: Spacing.sm, paddingBottom: 80 },
  row:          { gap: Spacing.sm },
  badge:        { flex: 1, alignItems: 'center', gap: Spacing.xs, padding: Spacing.md },
  badgeLocked:  { opacity: 0.55 },
  badgeEmoji:   { fontSize: 36 },
  emojiLocked:  {},
  badgeName:    { fontSize: Typography.sm, fontWeight: Typography.bold, color: Colors.text, textAlign: 'center' },
  badgeDesc:    { fontSize: Typography.xs, color: Colors.textSecondary, textAlign: 'center' },
  lockedTag:    { backgroundColor: Colors.border, borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  lockedText:   { fontSize: 9, color: Colors.textSecondary, fontWeight: Typography.semibold, textTransform: 'uppercase' },
});
