import React, { useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { useNotificationStore } from '@/store/notificationStore';
import type { NotificationItem } from '@/store/notificationStore';
import { EmptyState } from '@/components/ui';
import { Colors, Typography, Spacing, Radius } from '@/theme';
import { formatRelativeTime } from '@spendwise/shared';

const TYPE_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  budget_alert:  'stats-chart-outline',
  anomaly:       'warning-outline',
  weekly_digest: 'trophy-outline',
  debt_reminder: 'trending-down-outline',
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
          <EmptyState
            icon={<Ionicons name="notifications-outline" size={28} color={Colors.primary} />}
            title="No notifications yet"
            description="Budget alerts, unusual spending, your weekly score, and debt reminders will show up here."
          />
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
      <View style={styles.iconBg}>
        <Ionicons name={TYPE_ICON[item.type] ?? 'notifications-outline'} size={18} color={Colors.primary} />
      </View>
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

  row:       { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.base, borderWidth: 1, borderColor: Colors.border },
  rowUnread: { borderColor: Colors.primary + '40', backgroundColor: Colors.primary + '06' },
  iconBg:    { width: 36, height: 36, borderRadius: Radius.full, backgroundColor: Colors.primary + '12', alignItems: 'center', justifyContent: 'center' },
  info:      { flex: 1, gap: 2 },
  title:     { fontSize: Typography.base, fontWeight: Typography.medium, color: Colors.text },
  titleUnread: { fontWeight: Typography.bold },
  body:      { fontSize: Typography.sm, color: Colors.textSecondary },
  time:      { fontSize: Typography.xs, color: Colors.textTertiary, marginTop: 2 },
  dot:       { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary, marginTop: 6 },
});
