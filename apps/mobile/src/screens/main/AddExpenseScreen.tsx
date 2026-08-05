import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  KeyboardAvoidingView, Platform, TextInput, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore }    from '@/store/authStore';
import { useExpenseStore } from '@/store/expenseStore';
import { useBudgetStore }  from '@/store/budgetStore';
import { callEdgeFunction } from '@/lib/supabase';
import { Button, Input } from '@/components/ui';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/theme';
import {
  CATEGORIES, PAYMENT_METHODS, MOBILE_MONEY_TYPES, todayISO, parseExpenseLocally, getCustomCategories,
} from '@spendwise/shared';
import type { ExpenseCategory, PaymentMethod, MobileMoneyType } from '@spendwise/shared';
import type { AddExpenseProps } from '@/navigation/types';

export function AddExpenseScreen() {
  const nav    = useNavigation();
  const route  = useRoute<AddExpenseProps['route']>();
  const prefill = route.params?.prefill ?? {};
  const expenseId = route.params?.expenseId;

  const { user, profile } = useAuthStore();
  const { expenses, addExpense, updateExpense } = useExpenseStore();
  const { budgets } = useBudgetStore();

  // Custom categories typed elsewhere (on this or any other expense, or on a
  // budget) show up here as real selectable chips instead of always
  // requiring the "Custom" text field to be retyped from scratch.
  const customCategoryOptions = getCustomCategories([
    ...expenses.map(e => e.category),
    ...budgets.map(b => b.category),
  ]);

  // Editing an existing expense (tapped from ExpensesScreen) pre-fills from
  // the real record instead of the lighter `prefill` shape used by
  // AI-parsed/receipt-scanned quick-adds — those two entry points never
  // overlap, since expenseId is only ever set from a real, saved expense.
  const existing = expenseId ? expenses.find(e => e.id === expenseId) : undefined;
  const isEditing = !!existing;

  const [amount,          setAmount]          = useState(existing?.amount.toString() ?? prefill.amount?.toString() ?? '');
  const [description,     setDescription]     = useState(existing?.description ?? prefill.description ?? '');
  const [merchantName,    setMerchantName]    = useState(existing?.merchantName ?? prefill.merchantName ?? '');
  const [category,        setCategory]        = useState<ExpenseCategory>(existing?.category ?? prefill.category ?? 'other');
  const [useCustomCategory, setUseCustomCategory] = useState(false);
  const [customCategory,    setCustomCategory]    = useState('');
  const [paymentMethod,   setPaymentMethod]   = useState<PaymentMethod>(existing?.paymentMethod ?? prefill.paymentMethod ?? 'mobile_money');
  const [mobileMoneyType, setMobileMoneyType] = useState<MobileMoneyType | undefined>(existing?.mobileMoneyType ?? prefill.mobileMoneyType);
  const [date,            setDate]            = useState(existing?.date ?? prefill.date ?? todayISO());
  const [notes,           setNotes]           = useState(existing?.notes ?? '');
  const [nlpInput,        setNlpInput]        = useState('');
  const [loading,         setLoading]         = useState(false);
  const [mode,            setMode]            = useState<'form' | 'nlp'>('form');
  const [nlpLoading,      setNlpLoading]      = useState(false);
  const [customCategoryError, setCustomCategoryError] = useState<string | null>(null);
  const [formError,           setFormError]           = useState<string | null>(null);

  const currency = profile?.currency ?? 'GHS';

  useEffect(() => {
    nav.setOptions({ title: isEditing ? 'Edit Expense' : 'Add Expense' });
  }, [isEditing]);

  const handleNLPParse = async () => {
    if (!nlpInput.trim()) return;
    setNlpLoading(true);
    try {
      const result = await callEdgeFunction<{
        amount?: number; description?: string; merchant_name?: string;
        category?: ExpenseCategory; date?: string; payment_method?: PaymentMethod;
        confidence?: number;
      }>('parse-nlp-expense', { input: nlpInput, today: todayISO() });

      if (result.amount)        setAmount(result.amount.toString());
      if (result.description)   setDescription(result.description);
      if (result.merchant_name) setMerchantName(result.merchant_name);
      if (result.category)      setCategory(result.category);
      if (result.date)          setDate(result.date);
      if (result.payment_method) setPaymentMethod(result.payment_method);
      setMode('form');
    } catch {
      // The AI parser is unreachable (offline, or not deployed) — fall back to
      // a basic on-device guess rather than a dead end. It only reliably gets
      // amount + category, so the user still needs to check merchant/date.
      const local = parseExpenseLocally(nlpInput, todayISO());
      if (local.amount) setAmount(local.amount.toString());
      setDescription(local.description);
      setCategory(local.category);
      setDate(local.date);
      setMode('form');
      Alert.alert(
        'Filled in a rough guess',
        "Couldn't reach the AI parser, so this is a basic estimate — please check the amount, category, and merchant before saving.",
      );
    } finally {
      setNlpLoading(false);
    }
  };

  const handleSave = async () => {
    setCustomCategoryError(null);
    setFormError(null);
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      Alert.alert('Invalid amount', 'Please enter a valid amount.');
      return;
    }
    if (useCustomCategory && !customCategory.trim()) {
      setCustomCategoryError('Type a category name, or switch back to one of the presets.');
      return;
    }
    if (!user) return;
    const effectiveCategory = (useCustomCategory ? customCategory.trim() : category) as ExpenseCategory;
    setLoading(true);
    try {
      if (existing) {
        await updateExpense({
          ...existing,
          amount: amountNum, currency, category: effectiveCategory, paymentMethod,
          mobileMoneyType, description, merchantName, date, notes,
          updatedAt: new Date().toISOString(),
        });
      } else {
        await addExpense(user.id, {
          amount: amountNum, currency, category: effectiveCategory, paymentMethod,
          mobileMoneyType, description, merchantName, date, notes,
        });
      }
      nav.goBack();
    } catch (err: any) {
      setFormError(err.message ?? 'Could not save expense');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        {/* Mode Toggle — Quick Add (AI parsing) only makes sense when
            creating a new expense from scratch, not editing an existing one */}
        {!isEditing && (
          <View style={styles.modeToggle}>
            <TouchableOpacity
              style={[styles.modeTab, mode === 'form' && styles.modeTabActive]}
              onPress={() => setMode('form')}
            >
              <Ionicons name="create-outline" size={16} color={mode === 'form' ? Colors.primary : Colors.textSecondary} />
              <Text style={[styles.modeTabText, mode === 'form' && styles.modeTabTextActive]}>Form</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeTab, mode === 'nlp' && styles.modeTabActive]}
              onPress={() => setMode('nlp')}
            >
              <Ionicons name="chatbubble-outline" size={16} color={mode === 'nlp' ? Colors.primary : Colors.textSecondary} />
              <Text style={[styles.modeTabText, mode === 'nlp' && styles.modeTabTextActive]}>Quick Add</Text>
            </TouchableOpacity>
          </View>
        )}

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

          {/* NLP mode */}
          {mode === 'nlp' && (
            <View style={styles.nlpContainer}>
              <Text style={styles.nlpHint}>Describe your expense in plain English 👇</Text>
              <TextInput
                style={styles.nlpInput}
                placeholder={'e.g. "Spent 80 cedis on Bolt this morning"\n"Bought lunch at KFC, 78 Ghana"\n"Paid DSTV 120 via momo"'}
                value={nlpInput}
                onChangeText={setNlpInput}
                multiline
                placeholderTextColor={Colors.textTertiary}
              />
              <Button label="Parse & Fill Form ✨" onPress={handleNLPParse} loading={nlpLoading} fullWidth />
            </View>
          )}

          {/* Standard form */}
          {mode === 'form' && (
            <View style={styles.form}>
              {/* Amount */}
              <View style={styles.amountContainer}>
                <Text style={styles.currencySymbol}>{currency === 'GHS' ? '₵' : currency}</Text>
                <TextInput
                  style={styles.amountInput}
                  placeholder="0.00"
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                  placeholderTextColor={Colors.textTertiary}
                />
              </View>

              {/* Merchant */}
              <Input
                label="Merchant"
                placeholder="e.g. KFC, Bolt, DSTV..."
                value={merchantName}
                onChangeText={setMerchantName}
                leftIcon="storefront-outline"
              />

              {/* Description */}
              <Input
                label="Description (optional)"
                placeholder="What was this for?"
                value={description}
                onChangeText={setDescription}
                leftIcon="document-outline"
              />

              {/* Category */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Category</Text>
                <View style={styles.chipGrid}>
                  {Object.entries(CATEGORIES).map(([id, { emoji, label }]) => (
                    <TouchableOpacity
                      key={id}
                      style={[styles.chip, !useCustomCategory && category === id && styles.chipSelected]}
                      onPress={() => { setCategory(id as ExpenseCategory); setUseCustomCategory(false); }}
                    >
                      <Text style={styles.chipEmoji}>{emoji}</Text>
                      <Text style={[styles.chipText, !useCustomCategory && category === id && styles.chipTextSelected]}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  {customCategoryOptions.map(c => (
                    <TouchableOpacity
                      key={c}
                      style={[styles.chip, !useCustomCategory && category === c && styles.chipSelected]}
                      onPress={() => { setCategory(c as ExpenseCategory); setUseCustomCategory(false); }}
                    >
                      <Text style={styles.chipEmoji}>✨</Text>
                      <Text style={[styles.chipText, !useCustomCategory && category === c && styles.chipTextSelected]}>
                        {c}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    style={[styles.chip, useCustomCategory && styles.chipSelected]}
                    onPress={() => setUseCustomCategory(true)}
                  >
                    <Text style={styles.chipEmoji}>✏️</Text>
                    <Text style={[styles.chipText, useCustomCategory && styles.chipTextSelected]}>
                      Custom
                    </Text>
                  </TouchableOpacity>
                </View>
                {useCustomCategory && (
                  <Input
                    placeholder="Type a category, e.g. Haircut"
                    value={customCategory}
                    onChangeText={setCustomCategory}
                    leftIcon="pricetag-outline"
                    autoFocus
                    error={customCategoryError ?? undefined}
                  />
                )}
              </View>

              {/* Payment Method */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Payment method</Text>
                <View style={styles.payRow}>
                  {Object.entries(PAYMENT_METHODS).map(([id, { emoji, label }]) => (
                    <TouchableOpacity
                      key={id}
                      style={[styles.payBtn, paymentMethod === id && styles.payBtnSelected]}
                      onPress={() => setPaymentMethod(id as PaymentMethod)}
                    >
                      <Text>{emoji}</Text>
                      <Text style={[styles.payText, paymentMethod === id && styles.payTextSelected]}>{label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {paymentMethod === 'mobile_money' && (
                  <View style={styles.momoRow}>
                    {Object.entries(MOBILE_MONEY_TYPES).map(([id, { label, color }]) => (
                      <TouchableOpacity
                        key={id}
                        style={[styles.momoBtn, mobileMoneyType === id && { borderColor: color, backgroundColor: color + '15' }]}
                        onPress={() => setMobileMoneyType(id as MobileMoneyType)}
                      >
                        <Text style={[styles.momoText, mobileMoneyType === id && { color }]}>{label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              {/* Notes */}
              <Input
                label="Notes (optional)"
                placeholder="Any extra details..."
                value={notes}
                onChangeText={setNotes}
                leftIcon="document-text-outline"
              />
            </View>
          )}
        </ScrollView>

        {/* Save button */}
        <View style={styles.footer}>
          {formError && <Text style={styles.formError}>{formError}</Text>}
          <Button label={isEditing ? 'Save Changes' : 'Save Expense'} onPress={handleSave} loading={loading} fullWidth size="lg" />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.background },
  flex:    { flex: 1 },
  content: { padding: Spacing.base, paddingBottom: Spacing.xxxl, gap: Spacing.base },
  footer:  { padding: Spacing.base, backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.border, gap: Spacing.sm },
  formError: { fontSize: Typography.sm, color: Colors.danger, textAlign: 'center' },

  modeToggle:       { flexDirection: 'row', backgroundColor: Colors.surfaceAlt, margin: Spacing.base, borderRadius: Radius.lg, padding: 4 },
  modeTab:          { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.sm, gap: 6, borderRadius: Radius.md },
  modeTabActive:    { backgroundColor: Colors.surface, ...Shadows.sm },
  modeTabText:      { fontSize: Typography.sm, color: Colors.textSecondary, fontWeight: Typography.medium },
  modeTabTextActive:{ color: Colors.primary, fontWeight: Typography.semibold },

  nlpContainer: { gap: Spacing.md },
  nlpHint:      { fontSize: Typography.base, color: Colors.textSecondary, textAlign: 'center' },
  nlpInput:     { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.base, fontSize: Typography.base, color: Colors.text, minHeight: 120, textAlignVertical: 'top', borderWidth: 1.5, borderColor: Colors.border },

  form: { gap: Spacing.base },

  amountContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: Radius.xl, borderWidth: 2, borderColor: Colors.primary, padding: Spacing.base, gap: Spacing.sm },
  currencySymbol:  { fontSize: Typography.xxl, fontWeight: Typography.bold, color: Colors.primary },
  amountInput:     { flex: 1, fontSize: Typography.xxxl, fontWeight: Typography.bold, color: Colors.text },

  fieldGroup: { gap: Spacing.sm },
  fieldLabel: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  chipGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  chip:       { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.sm, paddingVertical: 6, borderRadius: Radius.full, backgroundColor: Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.border },
  chipSelected:    { backgroundColor: Colors.primary + '15', borderColor: Colors.primary },
  chipEmoji: { fontSize: 14 },
  chipText:  { fontSize: Typography.xs, color: Colors.textSecondary, fontWeight: Typography.medium },
  chipTextSelected: { color: Colors.primary, fontWeight: Typography.semibold },

  payRow:    { flexDirection: 'row', gap: Spacing.sm },
  payBtn:    { flex: 1, alignItems: 'center', gap: 4, padding: Spacing.sm, backgroundColor: Colors.surfaceAlt, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border },
  payBtnSelected: { borderColor: Colors.primary, backgroundColor: Colors.primary + '12' },
  payText:   { fontSize: Typography.xs, color: Colors.textSecondary, fontWeight: Typography.medium },
  payTextSelected: { color: Colors.primary, fontWeight: Typography.semibold },

  momoRow:  { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  momoBtn:  { flex: 1, alignItems: 'center', padding: Spacing.sm, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surfaceAlt },
  momoText: { fontSize: Typography.xs, fontWeight: Typography.medium, color: Colors.textSecondary },
});
