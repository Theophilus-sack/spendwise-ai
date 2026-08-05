import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, TextInput, RefreshControl, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase }       from '@/lib/supabase';
import { useAuthStore }   from '@/store/authStore';
import { useIncomeStore } from '@/store/incomeStore';
import { useBudgetStore } from '@/store/budgetStore';
import { Card, Button }   from '@/components/ui';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/theme';
import { formatCurrency, generateUUID, generateIncomeBasedBudgets } from '@spendwise/shared';
import type { IncomeEntry, IncomeSource } from '@spendwise/shared';

const SOURCE_LABELS: Record<IncomeSource, string> = {
  salary:      'Salary',
  freelance:   'Freelance',
  business:    'Business',
  investments: 'Investments',
  allowance:   'Allowance',
  other:       'Other',
};

const SOURCE_EMOJIS: Record<IncomeSource, string> = {
  salary:      '💼',
  freelance:   '💻',
  business:    '🏪',
  investments: '📈',
  allowance:   '🎓',
  other:       '💰',
};

const ALL_SOURCES: IncomeSource[] = ['salary', 'freelance', 'business', 'investments', 'allowance', 'other'];

export function IncomeScreen() {
  const { user, profile, fetchProfile } = useAuthStore();
  const { entries, loading, load, addEntry, deleteEntry, getTotalThisMonth } = useIncomeStore();
  const { budgets, load: loadBudgets, upsertBudget } = useBudgetStore();

  const [showModal, setShowModal] = useState(false);
  const [source,    setSource]    = useState<IncomeSource>('salary');
  const [name,      setName]      = useState('');
  const [amount,    setAmount]    = useState('');
  const [recurring, setRecurring] = useState(false);
  const [saving,    setSaving]    = useState(false);

  const [showPrimaryModal,  setShowPrimaryModal]  = useState(false);
  const [primaryInput,      setPrimaryInput]      = useState('');
  const [savingPrimary,     setSavingPrimary]     = useState(false);

  const currency = profile?.currency ?? 'GHS';

  const refresh = useCallback(async () => {
    if (user) await Promise.all([load(user.id), loadBudgets(user.id)]);
  }, [user]);

  useEffect(() => { refresh(); }, []);

  const primaryIncome = profile?.monthlyIncome ?? 0;
  const additionalThisMonth = getTotalThisMonth();
  const totalIncome = primaryIncome + additionalThisMonth;

  const handleAdd = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { Alert.alert('Invalid amount'); return; }
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const entry: IncomeEntry = {
        id:          generateUUID(),
        userId:      user!.id,
        source,
        sourceName:  name.trim() || undefined,
        amount:      amt,
        currency,
        date:        now.slice(0, 10),
        isRecurring: recurring,
        interval:    recurring ? 'monthly' : undefined,
        createdAt:   now,
      };
      await addEntry(entry);
      setShowModal(false);
      setAmount('');
      setName('');
      setSource('salary');
      setRecurring(false);
    } catch (err) {
      Alert.alert('Could not save', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const openEditPrimary = () => {
    setPrimaryInput(primaryIncome > 0 ? String(primaryIncome) : '');
    setShowPrimaryModal(true);
  };

  // A same-order-of-magnitude jump (e.g. typing 2 extra zeros) is the classic
  // fat-finger mistake on a numeric income field — flag it, don't block it.
  const isImplausibleJump = (oldVal: number, newVal: number): boolean => {
    if (oldVal <= 0 || newVal <= 0) return false;
    const ratio = newVal / oldVal;
    return ratio >= 8 || ratio <= 1 / 8;
  };

  const confirmAsync = (title: string, message: string, confirmLabel: string): Promise<boolean> =>
    new Promise(resolve => {
      Alert.alert(title, message, [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: confirmLabel, onPress: () => resolve(true) },
      ]);
    });

  const handleRecalculateBudgets = async (newIncome: number) => {
    if (!user) return;
    const lines = generateIncomeBasedBudgets(
      newIncome,
      (profile?.savingsTargetPct ?? 20) / 100,
      profile?.spendingPersonality ?? 'balanced',
    );
    const now = new Date().toISOString();
    for (const line of lines) {
      const match = budgets.find(b => b.category === line.category);
      await upsertBudget({
        id:           match?.id ?? generateUUID(),
        userId:       user.id,
        category:     line.category as any,
        description:  match?.description,
        limitAmount:  line.limit,
        period:       'monthly',
        rollover:     match?.rollover ?? false,
        aiSuggested:  true,
        createdAt:    match?.createdAt ?? now,
        updatedAt:    now,
      });
    }
  };

  const handleSavePrimary = async () => {
    if (!user) return;
    const val = parseFloat(primaryInput);
    if (isNaN(val) || val < 0) { Alert.alert('Invalid amount', 'Enter a valid monthly income.'); return; }

    if (isImplausibleJump(primaryIncome, val)) {
      const proceed = await confirmAsync(
        'Big change',
        `That's a jump from ${formatCurrency(primaryIncome, currency)} to ${formatCurrency(val, currency)} — did you mean to enter that?`,
        "Yes, that's right",
      );
      if (!proceed) return;
    }

    setSavingPrimary(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ monthly_income: val, updated_at: new Date().toISOString() })
        .eq('user_id', user.id);
      if (error) throw error;
      await fetchProfile();
      setShowPrimaryModal(false);

      // Meaningful change + there's an existing budget to reshape — offer to
      // rebuild it around the new income rather than leaving stale limits
      // that no longer relate to what the user actually earns.
      const changedMeaningfully = primaryIncome <= 0 || Math.abs(val - primaryIncome) / primaryIncome > 0.05;
      if (changedMeaningfully && budgets.length > 0) {
        const update = await confirmAsync(
          'Update your budgets?',
          `Recalculate your category budgets to match your new income${profile?.savingsTargetPct ? ` and ${profile.savingsTargetPct}% savings goal` : ''}?`,
          'Recalculate',
        );
        if (update) await handleRecalculateBudgets(val);
      }
    } catch (err) {
      Alert.alert('Could not save', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setSavingPrimary(false);
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Remove income?', 'This income entry will be removed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: () => {
          deleteEntry(id).catch(err => {
            Alert.alert('Could not remove', err instanceof Error ? err.message : 'Please try again.');
          });
        },
      },
    ]);
  };

  // group by source
  const bySource = entries.reduce<Record<string, IncomeEntry[]>>((acc, e) => {
    acc[e.source] = [...(acc[e.source] ?? []), e];
    return acc;
  }, {});

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={Colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero ── */}
        <LinearGradient colors={[Colors.primaryDark, Colors.primary]} style={styles.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <Text style={styles.heroLabel}>Total Monthly Income</Text>
          <Text style={styles.heroAmount}>{formatCurrency(totalIncome, currency)}</Text>
          <View style={styles.heroRow}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatLabel}>Base Salary</Text>
              <Text style={styles.heroStatValue}>{formatCurrency(primaryIncome, currency)}</Text>
            </View>
            <View style={styles.heroDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatLabel}>Additional</Text>
              <Text style={styles.heroStatValue}>{formatCurrency(additionalThisMonth, currency)}</Text>
            </View>
            <View style={styles.heroDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatLabel}>Sources</Text>
              <Text style={styles.heroStatValue}>{Object.keys(bySource).length + 1}</Text>
            </View>
          </View>
        </LinearGradient>

        {/* ── Primary income card ── */}
        <View style={styles.sectionLabel}><Text style={styles.sectionTitle}>Primary Income</Text></View>
        <Card style={styles.primaryCard}>
          <View style={styles.sourceRow}>
            <Text style={styles.sourceEmoji}>💼</Text>
            <View style={styles.sourceInfo}>
              <Text style={styles.sourceName}>Monthly Salary / Base</Text>
              <Text style={styles.sourceDate}>Recurring · monthly</Text>
            </View>
            <Text style={styles.sourceAmount}>{formatCurrency(primaryIncome, currency)}</Text>
            <TouchableOpacity onPress={openEditPrimary} style={styles.editPrimaryBtn}>
              <Ionicons name="pencil-outline" size={16} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </Card>

        {/* ── Alternative income ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Alternative Income</Text>
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowModal(true)}>
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.addBtnText}>Add</Text>
          </TouchableOpacity>
        </View>

        {entries.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>💸</Text>
            <Text style={styles.emptyTitle}>No alternative income yet</Text>
            <Text style={styles.emptySub}>Add freelance work, business revenue, investments and more</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => setShowModal(true)}>
              <Text style={styles.emptyBtnText}>+ Add income source</Text>
            </TouchableOpacity>
          </Card>
        ) : (
          Object.entries(bySource).map(([src, items]) => (
            <Card key={src} style={styles.sourceGroup}>
              <View style={styles.sourceGroupHeader}>
                <Text style={styles.sourceEmoji}>{SOURCE_EMOJIS[src as IncomeSource]}</Text>
                <Text style={styles.sourceGroupTitle}>{SOURCE_LABELS[src as IncomeSource]}</Text>
                <Text style={styles.sourceGroupTotal}>
                  {formatCurrency(items.reduce((s, e) => s + e.amount, 0), currency)}
                </Text>
              </View>
              {items.map(e => (
                <View key={e.id} style={styles.entryRow}>
                  <View style={styles.entryInfo}>
                    <Text style={styles.entryName}>{e.sourceName ?? SOURCE_LABELS[e.source]}</Text>
                    <Text style={styles.entryDate}>
                      {e.date} {e.isRecurring ? '· recurring' : '· one-time'}
                    </Text>
                  </View>
                  <Text style={styles.entryAmount}>{formatCurrency(e.amount, currency)}</Text>
                  <TouchableOpacity onPress={() => handleDelete(e.id)} style={styles.deleteBtn}>
                    <Ionicons name="trash-outline" size={16} color={Colors.danger} />
                  </TouchableOpacity>
                </View>
              ))}
            </Card>
          ))
        )}

        {/* ── Income tip ── */}
        <Card style={styles.tipCard}>
          <Ionicons name="bulb-outline" size={20} color={Colors.accent} />
          <Text style={styles.tipText}>
            Tracking all income sources helps SpendWise AI calculate a more accurate savings rate for your Financial Discipline Score.
          </Text>
        </Card>
      </ScrollView>

      {/* ── Add Income Modal ── */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowModal(false)}>
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Income Source</Text>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalContent}>
            {/* Source picker */}
            <Text style={styles.fieldLabel}>Source type</Text>
            <View style={styles.sourceGrid}>
              {ALL_SOURCES.map(s => (
                <TouchableOpacity
                  key={s}
                  style={[styles.sourceChip, source === s && styles.sourceChipActive]}
                  onPress={() => setSource(s)}
                >
                  <Text style={styles.sourceChipEmoji}>{SOURCE_EMOJIS[s]}</Text>
                  <Text style={[styles.sourceChipLabel, source === s && styles.sourceChipLabelActive]}>
                    {SOURCE_LABELS[s]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Name / description (optional)</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Logo design project"
              placeholderTextColor={Colors.textTertiary}
            />

            <Text style={styles.fieldLabel}>Amount ({currency})</Text>
            <TextInput
              style={styles.input}
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              placeholderTextColor={Colors.textTertiary}
              keyboardType="decimal-pad"
            />

            {/* Recurring toggle */}
            <TouchableOpacity style={styles.toggleRow} onPress={() => setRecurring(r => !r)}>
              <View style={[styles.toggle, recurring && styles.toggleOn]}>
                <View style={[styles.toggleDot, recurring && styles.toggleDotOn]} />
              </View>
              <Text style={styles.toggleLabel}>Recurring monthly income</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={handleAdd}
              disabled={saving}
            >
              <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Add Income'}</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ── Edit Primary Income Modal ── */}
      <Modal visible={showPrimaryModal} transparent animationType="slide" onRequestClose={() => setShowPrimaryModal(false)}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity
            style={styles.modalOverlayTouch}
            activeOpacity={1}
            onPress={() => setShowPrimaryModal(false)}
          >
            <TouchableOpacity activeOpacity={1} onPress={() => {}} style={styles.modalCard}>
              <Text style={styles.modalCardTitle}>Edit Base Salary</Text>
              <Text style={styles.modalCardSub}>This is your primary monthly income, set during onboarding.</Text>
              <Text style={styles.fieldLabel}>Amount ({currency})</Text>
              <TextInput
                style={styles.input}
                value={primaryInput}
                onChangeText={setPrimaryInput}
                placeholder="0.00"
                placeholderTextColor={Colors.textTertiary}
                keyboardType="decimal-pad"
                autoFocus
              />
              <View style={styles.modalCardActions}>
                <Button label="Cancel" onPress={() => setShowPrimaryModal(false)} variant="outline" style={{ flex: 1 }} />
                <Button label="Save" onPress={handleSavePrimary} loading={savingPrimary} style={{ flex: 1 }} />
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.base, gap: Spacing.base, paddingBottom: Spacing.xxxl },

  hero:        { borderRadius: Radius.xl, padding: Spacing.lg, gap: Spacing.md, ...Shadows.primary },
  heroLabel:   { fontSize: Typography.sm, color: 'rgba(255,255,255,0.75)', fontWeight: Typography.medium },
  heroAmount:  { fontSize: Typography.xxxl, fontWeight: Typography.bold, color: '#fff', letterSpacing: -1 },
  heroRow:     { flexDirection: 'row', alignItems: 'center' },
  heroStat:    { flex: 1, alignItems: 'center', gap: 2 },
  heroStatLabel: { fontSize: Typography.xs, color: 'rgba(255,255,255,0.65)' },
  heroStatValue: { fontSize: Typography.base, fontWeight: Typography.semibold, color: '#fff' },
  heroDivider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.2)' },

  sectionLabel:  { },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle:  { fontSize: Typography.base, fontWeight: Typography.bold, color: Colors.text },

  addBtn:     { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primary, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Radius.full },
  addBtnText: { color: '#fff', fontSize: Typography.sm, fontWeight: Typography.semibold },

  primaryCard: { gap: Spacing.sm },
  sourceRow:   { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  sourceEmoji: { fontSize: 28 },
  sourceInfo:  { flex: 1 },
  sourceName:  { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.text },
  sourceDate:  { fontSize: Typography.xs, color: Colors.textSecondary, marginTop: 2 },
  sourceAmount:{ fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.primary },
  editPrimaryBtn: { padding: Spacing.xs, marginLeft: Spacing.xs },

  sourceGroup:       { gap: Spacing.sm },
  sourceGroupHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingBottom: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  sourceGroupTitle:  { flex: 1, fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.text },
  sourceGroupTotal:  { fontSize: Typography.base, fontWeight: Typography.bold, color: Colors.primary },

  entryRow:    { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xs },
  entryInfo:   { flex: 1 },
  entryName:   { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.text },
  entryDate:   { fontSize: Typography.xs, color: Colors.textSecondary },
  entryAmount: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.text },
  deleteBtn:   { padding: Spacing.xs },

  emptyCard:  { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xl },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.text },
  emptySub:   { fontSize: Typography.sm, color: Colors.textSecondary, textAlign: 'center' },
  emptyBtn:   { backgroundColor: Colors.primary, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: Radius.full, marginTop: Spacing.sm },
  emptyBtnText: { color: '#fff', fontWeight: Typography.semibold },

  tipCard: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, backgroundColor: Colors.accent + '12', borderWidth: 1, borderColor: Colors.accent + '30' },
  tipText: { flex: 1, fontSize: Typography.sm, color: Colors.text, lineHeight: 20 },

  // Modal
  modal:         { flex: 1, backgroundColor: Colors.background },
  modalHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.base, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalTitle:    { fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.text },
  modalContent:  { padding: Spacing.base, gap: Spacing.base, paddingBottom: Spacing.xxxl },

  fieldLabel: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.text },
  input:      { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.base, fontSize: Typography.base, color: Colors.text, borderWidth: 1.5, borderColor: Colors.border },

  sourceGrid:          { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  sourceChip:          { width: '30%', alignItems: 'center', padding: Spacing.sm, borderRadius: Radius.md, backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: Colors.border, gap: 4 },
  sourceChipActive:    { borderColor: Colors.primary, backgroundColor: Colors.primary + '10' },
  sourceChipEmoji:     { fontSize: 22 },
  sourceChipLabel:     { fontSize: Typography.xs, color: Colors.textSecondary, textAlign: 'center' },
  sourceChipLabelActive: { color: Colors.primary, fontWeight: Typography.semibold },

  toggleRow:    { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  toggle:       { width: 46, height: 26, borderRadius: 13, backgroundColor: Colors.border, justifyContent: 'center', padding: 3 },
  toggleOn:     { backgroundColor: Colors.primary },
  toggleDot:    { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },
  toggleDotOn:  { alignSelf: 'flex-end' },
  toggleLabel:  { fontSize: Typography.base, color: Colors.text },

  saveBtn:         { backgroundColor: Colors.primary, borderRadius: Radius.lg, padding: Spacing.base, alignItems: 'center', marginTop: Spacing.sm },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText:     { color: '#fff', fontSize: Typography.base, fontWeight: Typography.bold },

  // Edit primary income modal (compact bottom sheet)
  modalOverlay:      { flex: 1 },
  modalOverlayTouch: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard:        { backgroundColor: Colors.surface, borderTopLeftRadius: Radius.xxl, borderTopRightRadius: Radius.xxl, padding: Spacing.xl, gap: Spacing.md },
  modalCardTitle:   { fontSize: Typography.xl, fontWeight: Typography.bold, color: Colors.text },
  modalCardSub:     { fontSize: Typography.sm, color: Colors.textSecondary, marginTop: -Spacing.xs },
  modalCardActions: { flexDirection: 'row', gap: Spacing.md },
});
