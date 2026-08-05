import React, { useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/authStore';
import { useNotificationStore } from '@/store/notificationStore';
import type { NotificationItem } from '@/store/notificationStore';
import { Colors, Typography, Spacing, Radius } from '@/theme';
import { formatRelativeTime } from '@spendwise/shared';

const TYPE_EMOJI: Record<string, string> = {
  budget_alert:   '📊',
  anomaly:        '⚠️',
  weekly_digest:  '🏆',
  debt_reminder:  '📉',
};

export function NotificationsScreen() {
  const user = useAuthStore(s => s.user);
  const { items, loading, load, markRead } = useNotificationStore();

  useEffect(() => { if (user) load(user.id); }, [user?.id]);

  if (loading && items.length === 0) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}><ActivityIndicator color={Colors.primary} size="large" /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        data={items}
        keyExtractor={n => n.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🔔</Text>
            <Text style={styles.emptyTitle}>No notifications yet</Text>
            <Text style={styles.emptyText}>Budget alerts, unusual spending, your weekly score, and debt reminders will show up here.</Text>
          </View>
        }
        renderItem={({ item }) => <NotificationRow item={item} onPress={() => !item.readAt && markRead(item.id)} />}
      />
    </SafeAreaView>
  );
}

function NotificationRow({ item, onPress }: { item: NotificationItem; onPress: () => void }) {
  const isUnread = !item.readAt;
  return (
    <TouchableOpacity style={[styles.row, isUnread && styles.rowUnread]} onPress={onPress} activeOpacity={0.7}>
      <Text style={styles.emoji}>{TYPE_EMOJI[item.type] ?? '🔔'}</Text>
      <View style={styles.info}>
        <Text style={[styles.title, isUnread && styles.titleUnread]}>{item.title}</Text>
        <Text style={styles.body}>{item.body}</Text>
        <Text style={styles.time}>{formatRelativeTime(item.sentAt)}</Text>
      </View>
      {isUnread && <View style={styles.dot} />}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe:     { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list:     { padding: Spacing.base, gap: Spacing.sm, paddingBottom: 80, flexGrow: 1 },

  empty:      { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: Spacing.xxxl, paddingHorizontal: Spacing.xl },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.text },
  emptyText:  { fontSize: Typography.sm, color: Colors.textSecondary, textAlign: 'center' },

  row:       { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.base, borderWidth: 1, borderColor: Colors.border },
  rowUnread: { borderColor: Colors.primary + '40', backgroundColor: Colors.primary + '06' },
  emoji:     { fontSize: 22 },
  info:      { flex: 1, gap: 2 },
  title:     { fontSize: Typography.base, fontWeight: Typography.medium, color: Colors.text },
  titleUnread: { fontWeight: Typography.bold },
  body:      { fontSize: Typography.sm, color: Colors.textSecondary },
  time:      { fontSize: Typography.xs, color: Colors.textTertiary, marginTop: 2 },
  dot:       { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary, marginTop: 6 },
});
