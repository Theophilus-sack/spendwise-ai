import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, SafeAreaView, Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useExpenseStore } from '@/store/expenseStore';
import { useAuthStore }    from '@/store/authStore';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/theme';
import {
  formatCurrency, formatDateShort, getCategoryEmoji, getCategoryLabel, CATEGORIES,
} from '@spendwise/shared';
import type { Expense, ExpenseCategory } from '@spendwise/shared';
import type { AppStackNavProp } from '@/navigation/types';

export function ExpensesScreen() {
  const nav = useNavigation<AppStackNavProp>();
  const { expenses, deleteExpense } = useExpenseStore();
  const { profile } = useAuthStore();
  const currency = (profile?.currency ?? 'GHS') as any;

  const [search,      setSearch]      = useState('');
  const [filterCat,   setFilterCat]   = useState<ExpenseCategory | 'all'>('all');

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return expenses.filter(e => {
      const matchSearch = !q
        || (e.merchantName?.toLowerCase().includes(q))
        || (e.description?.toLowerCase().includes(q))
        || getCategoryLabel(e.category).toLowerCase().includes(q);
      const matchCat = filterCat === 'all' || e.category === filterCat;
      return matchSearch && matchCat;
    });
  }, [expenses, search, filterCat]);

  const total = filtered.reduce((s, e) => s + e.amount, 0);

  const confirmDelete = (e: Expense) => {
    Alert.alert('Delete Expense', `Delete ${e.merchantName ?? e.description ?? getCategoryLabel(e.category)}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: () => {
          deleteExpense(e.id).catch(err => {
            Alert.alert('Sync failed', err instanceof Error ? err.message : 'Could not fully delete this expense. Please try again.');
          });
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Search */}
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={18} color={Colors.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by merchant or category..."
          value={search}
          onChangeText={setSearch}
          placeholderTextColor={Colors.textTertiary}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={Colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Category filter */}
      <FlatList
        horizontal
        data={[{ id: 'all', label: 'All', emoji: '📋' }, ...Object.entries(CATEGORIES).map(([id, { label, emoji }]) => ({ id, label, emoji }))]}
        keyExtractor={i => i.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.filterChip, filterCat === item.id && styles.filterChipActive]}
            onPress={() => setFilterCat(item.id as any)}
          >
            <Text style={styles.filterEmoji}>{item.emoji}</Text>
            <Text style={[styles.filterText, filterCat === item.id && styles.filterTextActive]}>{item.label}</Text>
          </TouchableOpacity>
        )}
      />

      {/* Total */}
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>{filtered.length} transactions</Text>
        <Text style={styles.totalAmount}>{formatCurrency(total, currency)}</Text>
      </View>

      {/* Expense list */}
      <FlatList
        data={filtered}
        keyExtractor={e => e.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item: e }) => (
          <TouchableOpacity
            style={styles.expenseRow}
            onLongPress={() => confirmDelete(e)}
            activeOpacity={0.8}
          >
            <View style={[styles.expIcon, { backgroundColor: Colors.categories[e.category as keyof typeof Colors.categories] + '22' }]}>
              <Text style={styles.expEmoji}>{getCategoryEmoji(e.category)}</Text>
            </View>
            <View style={styles.expInfo}>
              <Text style={styles.expName} numberOfLines={1}>
                {e.merchantName ?? e.description ?? getCategoryLabel(e.category)}
              </Text>
              <View style={styles.expMeta}>
                <Text style={styles.expDate}>{formatDateShort(e.date)}</Text>
                {e.aiCategorized && (
                  <View style={styles.aiBadge}>
                    <Text style={styles.aiBadgeText}>AI</Text>
                  </View>
                )}
              </View>
            </View>
            <Text style={styles.expAmount}>-{formatCurrency(e.amount, currency)}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🔍</Text>
            <Text style={styles.emptyText}>No expenses found</Text>
          </View>
        }
      />

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => nav.navigate('AddExpense', {})}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: Colors.background },
  searchBar:  { flexDirection: 'row', alignItems: 'center', margin: Spacing.base, backgroundColor: Colors.surface, borderRadius: Radius.lg, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  searchInput:{ flex: 1, fontSize: Typography.base, color: Colors.text },
  filterRow:  { paddingHorizontal: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing.sm },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Radius.full, backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: Colors.border },
  filterChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '12' },
  filterEmoji:{ fontSize: 14 },
  filterText: { fontSize: Typography.xs, color: Colors.textSecondary, fontWeight: Typography.medium },
  filterTextActive: { color: Colors.primary, fontWeight: Typography.semibold },
  totalRow:   { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: Spacing.base, paddingBottom: Spacing.sm },
  totalLabel: { fontSize: Typography.sm, color: Colors.textSecondary },
  totalAmount:{ fontSize: Typography.base, fontWeight: Typography.bold, color: Colors.text },
  list:       { padding: Spacing.base, gap: Spacing.sm, paddingBottom: 100 },
  expenseRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md, ...Shadows.sm },
  expIcon:    { width: 44, height: 44, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  expEmoji:   { fontSize: 22 },
  expInfo:    { flex: 1 },
  expName:    { fontSize: Typography.base, fontWeight: Typography.medium, color: Colors.text },
  expMeta:    { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: 2 },
  expDate:    { fontSize: Typography.xs, color: Colors.textSecondary },
  aiBadge:    { backgroundColor: Colors.primary + '15', borderRadius: Radius.full, paddingHorizontal: 6, paddingVertical: 1 },
  aiBadgeText:{ fontSize: 9, color: Colors.primary, fontWeight: Typography.bold, letterSpacing: 0.5 },
  expAmount:  { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.text },
  empty:      { alignItems: 'center', paddingTop: 80, gap: Spacing.md },
  emptyEmoji: { fontSize: 48 },
  emptyText:  { fontSize: Typography.base, color: Colors.textSecondary },
  fab:        { position: 'absolute', right: Spacing.lg, bottom: Spacing.xl, width: 56, height: 56, borderRadius: Radius.full, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', ...Shadows.primary },
});
