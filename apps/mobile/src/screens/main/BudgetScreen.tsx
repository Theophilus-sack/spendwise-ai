import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Modal, TextInput, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore }    from '@/store/authStore';
import { useExpenseStore } from '@/store/expenseStore';
import { useBudgetStore }  from '@/store/budgetStore';
import { useIncomeStore }  from '@/store/incomeStore';
import { Card, BudgetBar, Button } from '@/components/ui';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/theme';
import {
  CATEGORY_LIST, getCategoryEmoji, getCategoryLabel, formatCurrency, generateUUID, getCustomCategories,
} from '@spendwise/shared';
import type { Budget, BudgetStatus, ExpenseCategory } from '@spendwise/shared';
import type { AppStackNavProp } from '@/navigation/types';

export function BudgetScreen() {
  const nav = useNavigation<AppStackNavProp>();
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuthStore();
  const { expenses, getBudgetStatuses } = useExpenseStore();
  const { budgets, load, upsertBudget, deleteBudget } = useBudgetStore();
  const { load: loadIncome, getTotalThisMonth: getIncomeThisMonth } = useIncomeStore();

  const [showModal,  setShowModal]  = useState(false);
  const [editBudget, setEditBudget] = useState<BudgetStatus | null>(null);
  const [limitInput, setLimitInput] = useState('');
  const [editDescription, setEditDescription] = useState('');

  const [showAddModal,   setShowAddModal]   = useState(false);
  const [newCategory,    setNewCategory]    = useState<ExpenseCategory | null>(null);
  const [newLimitInput,  setNewLimitInput]  = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [useCustomCategory, setUseCustomCategory] = useState(false);
  const [customCategoryName, setCustomCategoryName] = useState('');
  const [saving,         setSaving]         = useState(false);

  const currency = profile?.currency ?? 'GHS';
  const statuses = getBudgetStatuses(budgets);
  const sorted   = [...statuses].sort((a, b) => b.percentage - a.percentage);

  const budgetedCategories = new Set(budgets.map(b => b.category));
  const availableCategories = CATEGORY_LIST.filter(c => !budgetedCategories.has(c));
  // Custom categories already typed on an expense (e.g. "Trustwash") that
  // don't have a budget yet — same cross-pollination as AddExpenseScreen's
  // customCategoryOptions, so a category typed on one screen shows up as a
  // real chip on the other instead of needing to be retyped.
  const customBudgetCategories = getCustomCategories(expenses.map(e => e.category))
    .filter(c => !budgetedCategories.has(c as ExpenseCategory));

  const totalBudget = budgets.reduce((s, b) => s + b.limitAmount, 0);
  const totalSpent  = statuses.reduce((s, b) => s + b.spent, 0);

  // Same calculation Dashboard uses for "Income" — kept identical on purpose so
  // this screen never shows a second, subtly-different "income" number.
  const totalIncome  = (profile?.monthlyIncome ?? 0) + getIncomeThisMonth();
  const budgetedPct  = totalIncome > 0 ? Math.round((totalBudget / totalIncome) * 100) : 0;
  const overAllocated = totalBudget > totalIncome;

  useEffect(() => {
    if (user) { load(user.id); loadIncome(user.id); }
  }, [user]);

  const openEdit = (b: BudgetStatus) => {
    setEditBudget(b);
    setLimitInput(b.limitAmount.toString());
    setEditDescription(b.description ?? '');
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
      description: editDescription.trim() || undefined,
      updatedAt: now,
    });
    setShowModal(false);
  };

  const openAdd = () => {
    setNewCategory(availableCategories[0] ?? null);
    setNewLimitInput('');
    setNewDescription('');
    setUseCustomCategory(false);
    setCustomCategoryName('');
    setShowAddModal(true);
  };

  const handleAddSave = async () => {
    if (!user) return;
    const effectiveCategory = useCustomCategory ? customCategoryName.trim() : newCategory;
    if (!effectiveCategory) { Alert.alert('Missing category', useCustomCategory ? 'Type a name for this category.' : 'Pick a category.'); return; }
    const val = parseFloat(newLimitInput);
    if (isNaN(val) || val <= 0) { Alert.alert('Invalid', 'Enter a valid amount'); return; }

    setSaving(true);
    try {
      const now = new Date().toISOString();
      const budget: Budget = {
        id:          generateUUID(),
        userId:      user.id,
        category:    effectiveCategory as ExpenseCategory,
        description: newDescription.trim() || undefined,
        limitAmount: val,
        period:      'monthly',
        rollover:    false,
        aiSuggested: false,
        createdAt:   now,
        updatedAt:   now,
      };
      await upsertBudget(budget);
      setShowAddModal(false);
    } catch (err) {
      Alert.alert('Could not save', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (b: BudgetStatus) => {
    Alert.alert(
      'Delete budget',
      `Remove your ${getCategoryLabel(b.category as any)} budget? This won't delete any expenses already logged.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteBudget(b.id) },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      {/* ── Header — bleeds behind the status bar so it blends with it ── */}
      <LinearGradient
        colors={[Colors.primaryDark, Colors.primary]}
        style={[styles.header, { paddingTop: insets.top + Spacing.md }]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      >
        <View style={styles.headerTop}>
          <View style={styles.headerBrand}>
            <View style={styles.headerIconBg}>
              <Ionicons name="pie-chart" size={20} color={Colors.primary} />
            </View>
            <Text style={styles.headerTitle}>SpendWise AI</Text>
          </View>
          <TouchableOpacity style={styles.headerActionBtn} onPress={() => nav.navigate('Analytics')} hitSlop={8}>
            <Ionicons name="bar-chart-outline" size={19} color="#fff" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <View style={styles.body}>
        <Text style={styles.pageTitle}>My Budget</Text>
        <Text style={styles.pageSubtitle}>Set limits and stay on track.</Text>
      </View>

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
        {totalIncome > 0 && (
          <Text style={[styles.incomeContext, overAllocated && styles.incomeContextWarn]}>
            {overAllocated
              ? `⚠️ Budgeted ${formatCurrency(totalBudget, currency)} — ${budgetedPct}% of your ${formatCurrency(totalIncome, currency)} income, more than you actually earn`
              : `${budgetedPct}% of your ${formatCurrency(totalIncome, currency)} monthly income is budgeted`}
          </Text>
        )}
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
                <Text style={styles.catPeriod}>{b.description ? b.description : `${b.period} budget`}</Text>
              </View>
              <TouchableOpacity onPress={() => openEdit(b)} style={styles.editBtn}>
                <Ionicons name="pencil-outline" size={16} color={Colors.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => confirmDelete(b)} style={styles.editBtn}>
                <Ionicons name="trash-outline" size={16} color={Colors.danger} />
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
          availableCategories.length > 0 || customBudgetCategories.length > 0 ? (
            <TouchableOpacity style={styles.addBudgetBtn} onPress={openAdd}>
              <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
              <Text style={styles.addBudgetText}>Add new budget category</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.allBudgetedText}>You've set a budget for every category 🎉</Text>
          )
        }
      />

      {/* Edit modal */}
      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TouchableOpacity style={styles.modalOverlayTouch} activeOpacity={1} onPress={() => setShowModal(false)}>
            <TouchableOpacity activeOpacity={1} onPress={() => {}} style={styles.modalCard}>
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
              <Text style={styles.modalLabel}>Description (optional)</Text>
              <TextInput
                style={styles.modalInputText}
                value={editDescription}
                onChangeText={setEditDescription}
                placeholder="e.g. Weekend outings only"
                placeholderTextColor={Colors.textTertiary}
              />
              <View style={styles.modalActions}>
                <Button label="Cancel" onPress={() => setShowModal(false)} variant="outline" style={{ flex: 1 }} />
                <Button label="Save" onPress={handleSave} style={{ flex: 1 }} />
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* Add budget modal */}
      <Modal visible={showAddModal} transparent animationType="slide" onRequestClose={() => setShowAddModal(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TouchableOpacity style={styles.modalOverlayTouch} activeOpacity={1} onPress={() => setShowAddModal(false)}>
            <TouchableOpacity activeOpacity={1} onPress={() => {}} style={styles.modalCard}>
              <Text style={styles.modalTitle}>Create Budget</Text>

              <Text style={styles.modalLabel}>Category</Text>
              <View style={styles.categoryGrid}>
                {availableCategories.map(c => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.categoryChip, !useCustomCategory && newCategory === c && styles.categoryChipActive]}
                    onPress={() => { setNewCategory(c); setUseCustomCategory(false); }}
                  >
                    <Text style={styles.categoryChipEmoji}>{getCategoryEmoji(c)}</Text>
                    <Text style={[styles.categoryChipLabel, !useCustomCategory && newCategory === c && styles.categoryChipLabelActive]}>
                      {getCategoryLabel(c)}
                    </Text>
                  </TouchableOpacity>
                ))}
                {customBudgetCategories.map(c => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.categoryChip, !useCustomCategory && newCategory === c && styles.categoryChipActive]}
                    onPress={() => { setNewCategory(c as ExpenseCategory); setUseCustomCategory(false); }}
                  >
                    <Text style={styles.categoryChipEmoji}>✨</Text>
                    <Text style={[styles.categoryChipLabel, !useCustomCategory && newCategory === c && styles.categoryChipLabelActive]}>
                      {c}
                    </Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={[styles.categoryChip, useCustomCategory && styles.categoryChipActive]}
                  onPress={() => setUseCustomCategory(true)}
                >
                  <Text style={styles.categoryChipEmoji}>✏️</Text>
                  <Text style={[styles.categoryChipLabel, useCustomCategory && styles.categoryChipLabelActive]}>Custom</Text>
                </TouchableOpacity>
              </View>

              {useCustomCategory && (
                <>
                  <Text style={styles.modalLabel}>Name</Text>
                  <TextInput
                    style={styles.modalInputText}
                    value={customCategoryName}
                    onChangeText={setCustomCategoryName}
                    placeholder="e.g. Weekend Faaji"
                    placeholderTextColor={Colors.textTertiary}
                    autoFocus
                  />
                </>
              )}

              <Text style={styles.modalLabel}>Monthly limit ({currency === 'GHS' ? '₵' : currency})</Text>
              <TextInput
                style={styles.modalInput}
                value={newLimitInput}
                onChangeText={setNewLimitInput}
                keyboardType="decimal-pad"
                placeholder="e.g. 500"
                placeholderTextColor={Colors.textTertiary}
              />

              <Text style={styles.modalLabel}>Description (optional)</Text>
              <TextInput
                style={styles.modalInputText}
                value={newDescription}
                onChangeText={setNewDescription}
                placeholder="Add optional description"
                placeholderTextColor={Colors.textTertiary}
              />

              <View style={styles.modalActions}>
                <Button label="Cancel" onPress={() => setShowAddModal(false)} variant="outline" style={{ flex: 1 }} />
                <Button
                  label="Create" onPress={handleAddSave} style={{ flex: 1 }}
                  loading={saving} disabled={useCustomCategory ? !customCategoryName.trim() : !newCategory}
                />
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  header: {
    paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl,
    borderBottomLeftRadius: Radius.xl, borderBottomRightRadius: Radius.xl,
    ...Shadows.primary,
  },
  headerTop:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerBrand: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  headerIconBg:{ width: 40, height: 40, borderRadius: Radius.md, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: Typography.base, fontWeight: Typography.bold, color: '#fff' },
  headerActionBtn: { width: 38, height: 38, borderRadius: Radius.full, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },

  body: { paddingHorizontal: Spacing.base, paddingTop: Spacing.lg, gap: Spacing.xs },
  pageTitle:    { fontSize: Typography.xxl, fontWeight: Typography.bold, color: Colors.text },
  pageSubtitle: { fontSize: Typography.sm, color: Colors.textSecondary },

  summaryCard: { marginHorizontal: Spacing.base, marginTop: Spacing.base, backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.base, ...Shadows.sm },
  summaryRow:  { flexDirection: 'row', alignItems: 'center' },
  summaryLabel:{ fontSize: Typography.xs, color: Colors.textSecondary, marginBottom: 4 },
  summaryValue:{ fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.text },
  summaryDivider: { width: 1, height: 40, backgroundColor: Colors.border, marginHorizontal: Spacing.base },
  incomeContext:     { fontSize: Typography.xs, color: Colors.textSecondary, marginTop: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border },
  incomeContextWarn: { color: Colors.danger, fontWeight: Typography.medium },

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
  allBudgetedText: { textAlign: 'center', fontSize: Typography.sm, color: Colors.textSecondary, padding: Spacing.base, marginTop: Spacing.sm },

  categoryGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  categoryChip:  { width: '30%', alignItems: 'center', padding: Spacing.sm, borderRadius: Radius.md, backgroundColor: Colors.surfaceAlt, borderWidth: 1.5, borderColor: Colors.border, gap: 4 },
  categoryChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '10' },
  categoryChipEmoji:  { fontSize: 22 },
  categoryChipLabel:  { fontSize: Typography.xs, color: Colors.textSecondary, textAlign: 'center' },
  categoryChipLabelActive: { color: Colors.primary, fontWeight: Typography.semibold },

  modalOverlay:      { flex: 1 },
  modalOverlayTouch: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard:    { backgroundColor: Colors.surface, borderTopLeftRadius: Radius.xxl, borderTopRightRadius: Radius.xxl, padding: Spacing.xl, gap: Spacing.md },
  modalTitle:   { fontSize: Typography.xl, fontWeight: Typography.bold, color: Colors.text },
  modalCategory:{ fontSize: Typography.lg, color: Colors.textSecondary },
  modalLabel:   { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.textSecondary },
  modalInput:   { backgroundColor: Colors.surfaceAlt, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border, padding: Spacing.base, fontSize: Typography.xl, color: Colors.text, fontWeight: Typography.semibold },
  modalInputText: { backgroundColor: Colors.surfaceAlt, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border, padding: Spacing.base, fontSize: Typography.base, color: Colors.text },
  modalActions: { flexDirection: 'row', gap: Spacing.md },
});
