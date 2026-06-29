import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Modal, TextInput, SafeAreaView, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore }    from '@/store/authStore';
import { useExpenseStore } from '@/store/expenseStore';
import { useBudgetStore }  from '@/store/budgetStore';
import { Card, BudgetBar, Button } from '@/components/ui';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/theme';
import {
  CATEGORIES, getCategoryEmoji, getCategoryLabel, formatCurrency,
} from '@spendwise/shared';
import type { Budget, BudgetStatus, ExpenseCategory } from '@spendwise/shared';

export function BudgetScreen() {
  const { user, profile } = useAuthStore();
  const { getBudgetStatuses } = useExpenseStore();
  const { budgets, load, upsertBudget, deleteBudget } = useBudgetStore();

  const [showModal,  setShowModal]  = useState(false);
  const [editBudget, setEditBudget] = useState<BudgetStatus | null>(null);
  const [limitInput, setLimitInput] = useState('');

  const currency = (profile?.currency ?? 'GHS') as any;
  const statuses = getBudgetStatuses(budgets);
  const sorted   = [...statuses].sort((a, b) => b.percentage - a.percentage);

  const totalBudget = budgets.reduce((s, b) => s + b.limitAmount, 0);
  const totalSpent  = statuses.reduce((s, b) => s + b.spent, 0);

  useEffect(() => { if (user) load(user.id); }, [user]);

  const openEdit = (b: BudgetStatus) => {
    setEditBudget(b);
    setLimitInput(b.limitAmount.toString());
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!editBudget || !user) return;
    const val = parseFloat(limitInput);
    if (isNaN(val) || val <= 0) { Alert.alert('Invalid', 'Enter a valid amount'); return; }
    const now = new Date().toISOString();
    await upsertBudget({
      ...editBudget,
      limitAmount: val,
      updatedAt: now,
    });
    setShowModal(false);
  };

  const handleAddNew = () => {
    // TODO: open category picker → set limit
    Alert.alert('Add Budget', 'Category budget creation coming in next sprint.');
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Summary card */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <View>
            <Text style={styles.summaryLabel}>Total Budget</Text>
            <Text style={styles.summaryValue}>{formatCurrency(totalBudget, currency)}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View>
            <Text style={styles.summaryLabel}>Total Spent</Text>
            <Text style={[styles.summaryValue, totalSpent > totalBudget && { color: Colors.danger }]}>
              {formatCurrency(totalSpent, currency)}
            </Text>
          </View>
          <View style={styles.summaryDivider} />
          <View>
            <Text style={styles.summaryLabel}>Remaining</Text>
            <Text style={[styles.summaryValue, { color: Colors.success }]}>
              {formatCurrency(Math.max(0, totalBudget - totalSpent), currency)}
            </Text>
          </View>
        </View>
      </View>

      <FlatList
        data={sorted}
        keyExtractor={b => b.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item: b }) => (
          <Card style={styles.budgetCard}>
            <View style={styles.budgetHeader}>
              <View style={[styles.catIconBg, { backgroundColor: Colors.categories[b.category as keyof typeof Colors.categories] + '22' }]}>
                <Text style={styles.catEmoji}>{getCategoryEmoji(b.category as any)}</Text>
              </View>
              <View style={styles.catInfo}>
                <Text style={styles.catName}>{getCategoryLabel(b.category as any)}</Text>
                <Text style={styles.catPeriod}>{b.period} budget</Text>
              </View>
              <TouchableOpacity onPress={() => openEdit(b)} style={styles.editBtn}>
                <Ionicons name="pencil-outline" size={16} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <BudgetBar spent={b.spent} limit={b.limitAmount} currency={currency} />
          </Card>
        )}
        ListHeaderComponent={
          budgets.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>📋</Text>
              <Text style={styles.emptyTitle}>No budgets yet</Text>
              <Text style={styles.emptyText}>Set monthly spending limits for each category to track your discipline.</Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          <TouchableOpacity style={styles.addBudgetBtn} onPress={handleAddNew}>
            <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
            <Text style={styles.addBudgetText}>Add new budget category</Text>
          </TouchableOpacity>
        }
      />

      {/* Edit modal */}
      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit Budget</Text>
            <Text style={styles.modalCategory}>
              {editBudget && getCategoryEmoji(editBudget.category as any)} {editBudget && getCategoryLabel(editBudget.category as any)}
            </Text>
            <Text style={styles.modalLabel}>Monthly limit ({currency === 'GHS' ? '₵' : currency})</Text>
            <TextInput
              style={styles.modalInput}
              value={limitInput}
              onChangeText={setLimitInput}
              keyboardType="decimal-pad"
              placeholder="e.g. 500"
              placeholderTextColor={Colors.textTertiary}
            />
            <View style={styles.modalActions}>
              <Button label="Cancel" onPress={() => setShowModal(false)} variant="outline" style={{ flex: 1 }} />
              <Button label="Save" onPress={handleSave} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  summaryCard: { margin: Spacing.base, backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.base, ...Shadows.sm },
  summaryRow:  { flexDirection: 'row', alignItems: 'center' },
  summaryLabel:{ fontSize: Typography.xs, color: Colors.textSecondary, marginBottom: 4 },
  summaryValue:{ fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.text },
  summaryDivider: { width: 1, height: 40, backgroundColor: Colors.border, marginHorizontal: Spacing.base },

  list: { padding: Spacing.base, gap: Spacing.sm, paddingBottom: 80 },

  budgetCard:  { gap: Spacing.md },
  budgetHeader:{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  catIconBg:   { width: 44, height: 44, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  catEmoji:    { fontSize: 22 },
  catInfo:     { flex: 1 },
  catName:     { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.text },
  catPeriod:   { fontSize: Typography.xs, color: Colors.textSecondary, textTransform: 'capitalize' },
  editBtn:     { padding: Spacing.sm },

  empty:      { alignItems: 'center', paddingVertical: Spacing.xxxl, gap: Spacing.md },
  emptyEmoji: { fontSize: 52 },
  emptyTitle: { fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.text },
  emptyText:  { fontSize: Typography.base, color: Colors.textSecondary, textAlign: 'center', paddingHorizontal: Spacing.xl },

  addBudgetBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, padding: Spacing.base, marginTop: Spacing.sm },
  addBudgetText:{ fontSize: Typography.base, color: Colors.primary, fontWeight: Typography.semibold },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard:    { backgroundColor: Colors.surface, borderTopLeftRadius: Radius.xxl, borderTopRightRadius: Radius.xxl, padding: Spacing.xl, gap: Spacing.md },
  modalTitle:   { fontSize: Typography.xl, fontWeight: Typography.bold, color: Colors.text },
  modalCategory:{ fontSize: Typography.lg, color: Colors.textSecondary },
  modalLabel:   { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.textSecondary },
  modalInput:   { backgroundColor: Colors.surfaceAlt, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border, padding: Spacing.base, fontSize: Typography.xl, color: Colors.text, fontWeight: Typography.semibold },
  modalActions: { flexDirection: 'row', gap: Spacing.md },
});
