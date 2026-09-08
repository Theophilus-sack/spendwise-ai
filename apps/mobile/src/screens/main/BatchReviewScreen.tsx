import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Modal, TextInput, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore }    from '@/store/authStore';
import { useExpenseStore } from '@/store/expenseStore';
import { useIncomeStore }  from '@/store/incomeStore';
import { Card, Button, Input, EmptyState } from '@/components/ui';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/theme';
import {
  CATEGORIES, PAYMENT_METHODS, getCategoryEmoji, getCategoryLabel,
  formatCurrency, getCustomCategories, generateUUID,
} from '@spendwise/shared';
import type { DraftExpense, ExpenseCategory, PaymentMethod } from '@spendwise/shared';
import type { BatchReviewProps } from '@/navigation/types';

const SOURCE_LABEL: Record<DraftExpense['source'], string> = {
  'quick-add': 'Quick Add',
  'voice':     'Voice',
  'statement': 'Statement',
};

export function BatchReviewScreen() {
  const nav   = useNavigation();
  const route = useRoute<BatchReviewProps['route']>();
  const { user, profile } = useAuthStore();
  const { expenses, addExpense } = useExpenseStore();
  const { addEntry: addIncome } = useIncomeStore();

  const [items, setItems] = useState<DraftExpense[]>(route.params.drafts);
  const [editing, setEditing] = useState<DraftExpense | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  // Edit-modal draft state (only populated while `editing` is set)
  const [editAmount,   setEditAmount]   = useState('');
  const [editMerchant, setEditMerchant] = useState('');
  const [editDesc,     setEditDesc]     = useState('');
  const [editCategory, setEditCategory] = useState<ExpenseCategory>('other');
  const [editUseCustomCategory, setEditUseCustomCategory] = useState(false);
  const [editCustomCategory,    setEditCustomCategory]    = useState('');
  const [editPaymentMethod, setEditPaymentMethod] = useState<PaymentMethod>('cash');

  const currency = profile?.currency ?? 'GHS';
  const customCategoryOptions = getCustomCategories([
    ...expenses.map(e => e.category),
    ...items.map(i => i.category),
  ]);

  const selectedCount = items.filter(i => i.selected).length;

  const toggleSelected = (id: string) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, selected: !i.selected } : i));
  };

  const discard = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const openEdit = (item: DraftExpense) => {
    setEditing(item);
    setEditAmount(item.amount ? item.amount.toString() : '');
    setEditMerchant(item.merchantName ?? '');
    setEditDesc(item.description ?? '');
    const isCustom = !(item.category in CATEGORIES);
    setEditUseCustomCategory(isCustom);
    setEditCategory(isCustom ? 'other' : item.category);
    setEditCustomCategory(isCustom ? item.category : '');
    setEditPaymentMethod(item.paymentMethod ?? 'cash');
  };

  const saveEdit = () => {
    if (!editing) return;
    const amountNum = parseFloat(editAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      Alert.alert('Invalid amount', 'Please enter a valid amount.');
      return;
    }
    const effectiveCategory = (editUseCustomCategory ? editCustomCategory.trim() : editCategory) as ExpenseCategory;
    if (editUseCustomCategory && !effectiveCategory) {
      Alert.alert('Missing category', 'Type a category name, or switch back to one of the presets.');
      return;
    }
    setItems(prev => prev.map(i => i.id === editing.id ? {
      ...i,
      amount: amountNum,
      merchantName: editMerchant.trim() || undefined,
      description: editDesc.trim() || undefined,
      category: effectiveCategory,
      paymentMethod: editPaymentMethod,
    } : i));
    setEditing(null);
  };

  const handleConfirmAll = async () => {
    const toAdd = items.filter(i => i.selected);
    if (toAdd.length === 0) {
      Alert.alert('Nothing selected', 'Select at least one expense to add.');
      return;
    }
    if (!user) return;

    setConfirming(true);
    const failedIds = new Set<string>();
    let expenseCount = 0;
    let incomeCount  = 0;
    for (let i = 0; i < toAdd.length; i++) {
      const draft = toAdd[i];
      setProgress(`Adding ${i + 1} of ${toAdd.length}…`);
      try {
        if (draft.isIncome) {
          const now = new Date().toISOString();
          await addIncome({
            id:          generateUUID(),
            userId:      user.id,
            source:      'other',
            sourceName:  draft.merchantName ?? draft.description,
            amount:      draft.amount,
            currency:    draft.currency ?? currency,
            date:        draft.date,
            isRecurring: false,
            notes:       draft.notes,
            createdAt:   now,
          });
          incomeCount++;
        } else {
          await addExpense(user.id, {
            amount:          draft.amount,
            currency:        draft.currency ?? currency,
            category:        draft.category,
            merchantName:    draft.merchantName,
            paymentMethod:   draft.paymentMethod,
            mobileMoneyType: draft.mobileMoneyType,
            description:     draft.description,
            notes:           draft.notes,
            date:            draft.date,
          }, true); // this review screen is the human sign-off — trust the category shown, don't re-guess it
          expenseCount++;
        }
      } catch {
        failedIds.add(draft.id);
      }
    }
    setConfirming(false);
    setProgress(null);

    setItems(prev => prev.filter(i => !i.selected || failedIds.has(i.id)));

    const parts: string[] = [];
    if (expenseCount > 0) parts.push(`${expenseCount} expense${expenseCount === 1 ? '' : 's'}`);
    if (incomeCount  > 0) parts.push(`${incomeCount} income entr${incomeCount === 1 ? 'y' : 'ies'}`);
    const addedSummary = parts.join(' and ');

    if (failedIds.size > 0) {
      Alert.alert(
        'Some items failed',
        `${addedSummary} added, ${failedIds.size} couldn't be saved — check your connection and try again.`,
      );
    } else {
      Alert.alert(
        'Added',
        `${addedSummary} added.`,
        [{ text: 'OK', onPress: () => nav.goBack() }],
      );
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <View style={styles.body}>
        <Text style={styles.pageTitle}>Review {items.length} item{items.length === 1 ? '' : 's'}</Text>
        <Text style={styles.pageSubtitle}>Edit, remove, or confirm before adding.</Text>
      </View>

      <FlatList
        data={items}
        keyExtractor={i => i.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <Card style={styles.row}>
            <TouchableOpacity onPress={() => toggleSelected(item.id)} hitSlop={8}>
              <Ionicons
                name={item.selected ? 'checkbox' : 'square-outline'}
                size={22}
                color={item.selected ? Colors.primary : Colors.textTertiary}
              />
            </TouchableOpacity>

            {item.isIncome ? (
              <View style={[styles.catIconBg, { backgroundColor: Colors.success + '22' }]}>
                <Ionicons name="trending-up" size={18} color={Colors.success} />
              </View>
            ) : (
              <View style={[styles.catIconBg, { backgroundColor: Colors.categories[item.category as keyof typeof Colors.categories] + '22' }]}>
                <Text style={styles.catEmoji}>{getCategoryEmoji(item.category)}</Text>
              </View>
            )}

            <View style={styles.rowInfo}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {item.merchantName || item.description || (item.isIncome ? 'Income' : getCategoryLabel(item.category))}
              </Text>
              <Text style={styles.rowSubtitle} numberOfLines={1}>
                {item.isIncome ? 'Income' : getCategoryLabel(item.category)} · {SOURCE_LABEL[item.source]}
              </Text>
            </View>

            <Text style={[styles.rowAmount, item.isIncome && styles.rowAmountIncome]}>
              {item.isIncome ? '+' : ''}{formatCurrency(item.amount, currency)}
            </Text>

            <TouchableOpacity onPress={() => openEdit(item)} style={styles.rowBtn}>
              <Ionicons name="pencil-outline" size={16} color={Colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => discard(item.id)} style={styles.rowBtn}>
              <Ionicons name="trash-outline" size={16} color={Colors.danger} />
            </TouchableOpacity>
          </Card>
        )}
        ListEmptyComponent={
          <EmptyState
            icon={<Ionicons name="checkmark-done-outline" size={28} color={Colors.primary} />}
            title="Nothing left to review"
          />
        }
      />

      <View style={styles.footer}>
        <Button
          label={confirming ? (progress ?? 'Adding…') : `Confirm All (${selectedCount})`}
          onPress={handleConfirmAll}
          loading={confirming}
          disabled={selectedCount === 0}
          fullWidth
          size="lg"
        />
      </View>

      {/* Edit modal */}
      <Modal visible={!!editing} transparent animationType="slide" onRequestClose={() => setEditing(null)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TouchableOpacity style={styles.modalOverlayTouch} activeOpacity={1} onPress={() => setEditing(null)}>
            <TouchableOpacity activeOpacity={1} onPress={() => {}} style={styles.modalCard}>
              <Text style={styles.modalTitle}>{editing?.isIncome ? 'Edit Income' : 'Edit Expense'}</Text>

              <Text style={styles.modalLabel}>Amount ({currency === 'GHS' ? '₵' : currency})</Text>
              <TextInput
                style={styles.modalInput}
                value={editAmount}
                onChangeText={setEditAmount}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={Colors.textTertiary}
              />

              <Input
                label={editing?.isIncome ? 'Source' : 'Merchant'}
                placeholder={editing?.isIncome ? 'e.g. Client payment, Refund...' : 'e.g. KFC, Bolt, DSTV...'}
                value={editMerchant}
                onChangeText={setEditMerchant}
                leftIcon="storefront-outline"
              />
              <Input
                label="Description (optional)"
                placeholder="What was this for?"
                value={editDesc}
                onChangeText={setEditDesc}
                leftIcon="document-outline"
              />

              {!editing?.isIncome && (<>
              <Text style={styles.modalLabel}>Category</Text>
              <View style={styles.chipGrid}>
                {Object.entries(CATEGORIES).map(([id, { emoji, label }]) => (
                  <TouchableOpacity
                    key={id}
                    style={[styles.chip, !editUseCustomCategory && editCategory === id && styles.chipSelected]}
                    onPress={() => { setEditCategory(id as ExpenseCategory); setEditUseCustomCategory(false); }}
                  >
                    <Text style={styles.chipEmoji}>{emoji}</Text>
                    <Text style={[styles.chipText, !editUseCustomCategory && editCategory === id && styles.chipTextSelected]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
                {customCategoryOptions.map(c => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.chip, editUseCustomCategory && editCustomCategory === c && styles.chipSelected]}
                    onPress={() => { setEditUseCustomCategory(true); setEditCustomCategory(c); }}
                  >
                    <Ionicons name="pricetag-outline" size={14} color={Colors.textSecondary} />
                    <Text style={[styles.chipText, editUseCustomCategory && editCustomCategory === c && styles.chipTextSelected]}>
                      {c}
                    </Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={[styles.chip, editUseCustomCategory && !customCategoryOptions.includes(editCustomCategory) && styles.chipSelected]}
                  onPress={() => { setEditUseCustomCategory(true); setEditCustomCategory(''); }}
                >
                  <Ionicons name="create-outline" size={14} color={Colors.textSecondary} />
                  <Text style={styles.chipText}>Custom</Text>
                </TouchableOpacity>
              </View>
              {editUseCustomCategory && !customCategoryOptions.includes(editCustomCategory) && (
                <Input
                  placeholder="Type a category, e.g. Haircut"
                  value={editCustomCategory}
                  onChangeText={setEditCustomCategory}
                  leftIcon="pricetag-outline"
                  autoFocus
                />
              )}

              <Text style={styles.modalLabel}>Payment method</Text>
              <View style={styles.payRow}>
                {Object.entries(PAYMENT_METHODS).map(([id, { emoji, label }]) => (
                  <TouchableOpacity
                    key={id}
                    style={[styles.payBtn, editPaymentMethod === id && styles.payBtnSelected]}
                    onPress={() => setEditPaymentMethod(id as PaymentMethod)}
                  >
                    <Text>{emoji}</Text>
                    <Text style={[styles.payText, editPaymentMethod === id && styles.payTextSelected]}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              </>)}

              <View style={styles.modalActions}>
                <Button label="Cancel" onPress={() => setEditing(null)} variant="outline" style={{ flex: 1 }} />
                <Button label="Save" onPress={saveEdit} style={{ flex: 1 }} />
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

  body: { paddingHorizontal: Spacing.base, paddingTop: Spacing.lg, gap: Spacing.xs },
  pageTitle:    { fontSize: Typography.xl, fontWeight: Typography.bold, color: Colors.text },
  pageSubtitle: { fontSize: Typography.sm, color: Colors.textSecondary },

  list: { padding: Spacing.base, gap: Spacing.sm, paddingBottom: 100 },

  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  catIconBg: { width: 38, height: 38, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  catEmoji:  { fontSize: 18 },
  rowInfo:   { flex: 1 },
  rowTitle:  { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.text },
  rowSubtitle: { fontSize: Typography.xs, color: Colors.textSecondary, marginTop: 2 },
  rowAmount: { fontSize: Typography.base, fontWeight: Typography.bold, color: Colors.text },
  rowAmountIncome: { color: Colors.success },
  rowBtn:    { padding: Spacing.xs },

  footer: { padding: Spacing.base, backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.border },

  modalOverlay:      { flex: 1 },
  modalOverlayTouch: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard:    { backgroundColor: Colors.surface, borderTopLeftRadius: Radius.xxl, borderTopRightRadius: Radius.xxl, padding: Spacing.xl, gap: Spacing.md, maxHeight: '85%' },
  modalTitle:   { fontSize: Typography.xl, fontWeight: Typography.bold, color: Colors.text },
  modalLabel:   { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.textSecondary },
  modalInput:   { backgroundColor: Colors.surfaceAlt, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border, padding: Spacing.base, fontSize: Typography.xl, color: Colors.text, fontWeight: Typography.semibold },
  modalActions: { flexDirection: 'row', gap: Spacing.md },

  chipGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  chip:      { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.sm, paddingVertical: 6, borderRadius: Radius.full, backgroundColor: Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.border },
  chipSelected:    { backgroundColor: Colors.primary + '15', borderColor: Colors.primary },
  chipEmoji: { fontSize: 14 },
  chipText:  { fontSize: Typography.xs, color: Colors.textSecondary, fontWeight: Typography.medium },
  chipTextSelected: { color: Colors.primary, fontWeight: Typography.semibold },

  payRow:    { flexDirection: 'row', gap: Spacing.sm },
  payBtn:    { flex: 1, alignItems: 'center', gap: 4, padding: Spacing.sm, backgroundColor: Colors.surfaceAlt, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border },
  payBtnSelected: { borderColor: Colors.primary, backgroundColor: Colors.primary + '12' },
  payText:   { fontSize: Typography.xs, color: Colors.textSecondary, fontWeight: Typography.medium },
  payTextSelected: { color: Colors.primary, fontWeight: Typography.semibold },
});
