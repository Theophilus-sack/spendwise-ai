import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView,
  Modal, TextInput, RefreshControl, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '@/store/authStore';
import { useDebtStore } from '@/store/debtStore';
import { Card, Button } from '@/components/ui';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/theme';
import { formatCurrency, DEBT_TYPES } from '@spendwise/shared';
import type { Debt, DebtType } from '@spendwise/shared';

const ALL_DEBT_TYPES: DebtType[] = ['loan', 'credit_card', 'i_owe', 'owed_to_me'];

export function DebtsScreen() {
  const { user, profile } = useAuthStore();
  const { debts, loading, load, addDebt, updateDebt, deleteDebt, recordPayment } = useDebtStore();

  const currency = (profile?.currency ?? 'GHS') as any;

  const [showForm,   setShowForm]   = useState(false);
  const [editing,    setEditing]    = useState<Debt | null>(null);
  const [saving,     setSaving]     = useState(false);
  const [debtType,       setDebtType]       = useState<DebtType>('loan');
  const [label,          setLabel]          = useState('');
  const [lenderName,     setLenderName]     = useState('');
  const [principalInput, setPrincipalInput] = useState('');
  const [balanceInput,   setBalanceInput]   = useState('');
  const [interestInput,  setInterestInput]  = useState('');
  const [minPaymentInput,setMinPaymentInput]= useState('');
  const [dueDayInput,    setDueDayInput]    = useState('');

  const [payingDebt,   setPayingDebt]   = useState<Debt | null>(null);
  const [paymentInput, setPaymentInput] = useState('');
  const [payingSaving, setPayingSaving] = useState(false);

  const refresh = useCallback(async () => {
    if (user) await load(user.id);
  }, [user]);

  useEffect(() => { refresh(); }, []);

  const activeDebts = debts.filter(d => d.status === 'active');
  const paidDebts   = debts.filter(d => d.status === 'paid');
  const sortedActive = [...activeDebts].sort((a, b) => b.currentBalance - a.currentBalance);

  const youOwe = activeDebts
    .filter(d => DEBT_TYPES[d.debtType].direction === 'owe')
    .reduce((s, d) => s + d.currentBalance, 0);
  const owedToYou = activeDebts
    .filter(d => DEBT_TYPES[d.debtType].direction === 'owed')
    .reduce((s, d) => s + d.currentBalance, 0);

  const resetForm = () => {
    setEditing(null);
    setDebtType('loan');
    setLabel('');
    setLenderName('');
    setPrincipalInput('');
    setBalanceInput('');
    setInterestInput('');
    setMinPaymentInput('');
    setDueDayInput('');
  };

  const openAdd = () => { resetForm(); setShowForm(true); };

  const openEdit = (d: Debt) => {
    setEditing(d);
    setDebtType(d.debtType);
    setLabel(d.label);
    setLenderName(d.lenderName ?? '');
    setPrincipalInput(String(d.principalAmount));
    setBalanceInput(String(d.currentBalance));
    setInterestInput(d.interestRatePct ? String(d.interestRatePct) : '');
    setMinPaymentInput(d.minPayment ? String(d.minPayment) : '');
    setDueDayInput(d.dueDayOfMonth ? String(d.dueDayOfMonth) : '');
    setShowForm(true);
  };

  const handleSaveForm = async () => {
    if (!user) return;
    if (!label.trim()) { Alert.alert('Missing label', 'Give this debt a name, e.g. "Car loan".'); return; }
    const principal = parseFloat(principalInput);
    const balance   = parseFloat(balanceInput || principalInput);
    if (isNaN(principal) || principal <= 0) { Alert.alert('Invalid amount', 'Enter the original amount.'); return; }
    if (isNaN(balance) || balance < 0) { Alert.alert('Invalid amount', 'Enter the current balance.'); return; }

    setSaving(true);
    try {
      const now = new Date().toISOString();
      const debt: Debt = {
        id:              editing?.id ?? `debt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        userId:          user.id,
        label:           label.trim(),
        debtType,
        principalAmount: principal,
        currentBalance:  balance,
        interestRatePct: parseFloat(interestInput) || 0,
        minPayment:      minPaymentInput ? parseFloat(minPaymentInput) : undefined,
        dueDayOfMonth:   dueDayInput ? parseInt(dueDayInput, 10) : undefined,
        lenderName:      lenderName.trim() || undefined,
        status:          balance === 0 ? 'paid' : 'active',
        createdAt:       editing?.createdAt ?? now,
        updatedAt:       now,
      };
      if (editing) await updateDebt(debt); else await addDebt(debt);
      setShowForm(false);
      resetForm();
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (d: Debt) => {
    Alert.alert('Delete this record?', `Remove "${d.label}" and its payment history. This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteDebt(d.id) },
    ]);
  };

  const openPayment = (d: Debt) => { setPayingDebt(d); setPaymentInput(''); };

  const handleRecordPayment = async () => {
    if (!payingDebt) return;
    const amt = parseFloat(paymentInput);
    if (isNaN(amt) || amt <= 0) { Alert.alert('Invalid amount', 'Enter how much you paid.'); return; }

    setPayingSaving(true);
    try {
      await recordPayment(payingDebt.id, amt, new Date().toISOString().slice(0, 10));
      setPayingDebt(null);
      setPaymentInput('');
    } finally {
      setPayingSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={Colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Summary ── */}
        <LinearGradient colors={[Colors.primaryDark, Colors.primary]} style={styles.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <View style={styles.heroStat}>
            <Text style={styles.heroLabel}>You Owe</Text>
            <Text style={styles.heroAmount}>{formatCurrency(youOwe, currency)}</Text>
          </View>
          <View style={styles.heroDivider} />
          <View style={styles.heroStat}>
            <Text style={styles.heroLabel}>Owed to You</Text>
            <Text style={styles.heroAmount}>{formatCurrency(owedToYou, currency)}</Text>
          </View>
        </LinearGradient>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Active</Text>
          <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.addBtnText}>Add</Text>
          </TouchableOpacity>
        </View>

        {sortedActive.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>📉</Text>
            <Text style={styles.emptyTitle}>Nothing tracked yet</Text>
            <Text style={styles.emptySub}>Add a loan, credit card, or money you owe (or are owed) to keep track of repayment.</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={openAdd}>
              <Text style={styles.emptyBtnText}>+ Add a debt</Text>
            </TouchableOpacity>
          </Card>
        ) : (
          sortedActive.map(d => {
            const paidOffPct = d.principalAmount > 0
              ? Math.min(100, Math.round((1 - d.currentBalance / d.principalAmount) * 100))
              : 0;
            const meta = DEBT_TYPES[d.debtType];
            return (
              <Card key={d.id} style={styles.debtCard}>
                <View style={styles.debtHeader}>
                  <Text style={styles.debtEmoji}>{meta.emoji}</Text>
                  <View style={styles.debtInfo}>
                    <Text style={styles.debtLabel}>{d.label}</Text>
                    <Text style={styles.debtSub}>
                      {meta.label}{d.lenderName ? ` · ${d.lenderName}` : ''}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => openEdit(d)} style={styles.iconBtn}>
                    <Ionicons name="pencil-outline" size={16} color={Colors.textSecondary} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => confirmDelete(d)} style={styles.iconBtn}>
                    <Ionicons name="trash-outline" size={16} color={Colors.danger} />
                  </TouchableOpacity>
                </View>

                <View style={styles.balanceRow}>
                  <Text style={styles.balanceValue}>{formatCurrency(d.currentBalance, currency)}</Text>
                  <Text style={styles.balanceSub}>of {formatCurrency(d.principalAmount, currency)}</Text>
                </View>

                {meta.direction === 'owe' && (
                  <>
                    <View style={styles.barTrack}>
                      <View style={[styles.barFill, { width: `${paidOffPct}%` }]} />
                    </View>
                    <Text style={styles.paidOffText}>{paidOffPct}% paid off</Text>
                  </>
                )}

                <View style={styles.metaRow}>
                  {d.interestRatePct > 0 && <Text style={styles.metaChip}>{d.interestRatePct}% interest</Text>}
                  {d.minPayment ? <Text style={styles.metaChip}>Min {formatCurrency(d.minPayment, currency)}</Text> : null}
                  {d.dueDayOfMonth ? <Text style={styles.metaChip}>Due day {d.dueDayOfMonth}</Text> : null}
                </View>

                {meta.direction === 'owe' && (
                  <Button label="Record a payment" variant="outline" size="sm" onPress={() => openPayment(d)} />
                )}
              </Card>
            );
          })
        )}

        {paidDebts.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Paid Off 🎉</Text>
            </View>
            {paidDebts.map(d => (
              <Card key={d.id} style={styles.paidCard}>
                <Text style={styles.paidEmoji}>{DEBT_TYPES[d.debtType].emoji}</Text>
                <View style={styles.debtInfo}>
                  <Text style={styles.debtLabel}>{d.label}</Text>
                  <Text style={styles.debtSub}>{formatCurrency(d.principalAmount, currency)} cleared</Text>
                </View>
                <TouchableOpacity onPress={() => confirmDelete(d)} style={styles.iconBtn}>
                  <Ionicons name="trash-outline" size={16} color={Colors.textTertiary} />
                </TouchableOpacity>
              </Card>
            ))}
          </>
        )}
      </ScrollView>

      {/* ── Add / Edit Debt Modal ── */}
      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowForm(false)}>
        <SafeAreaView style={styles.formModal}>
          <View style={styles.formHeader}>
            <Text style={styles.formTitle}>{editing ? 'Edit' : 'Add'} Debt</Text>
            <TouchableOpacity onPress={() => setShowForm(false)}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
            <Text style={styles.fieldLabel}>Type</Text>
            <View style={styles.typeGrid}>
              {ALL_DEBT_TYPES.map(t => (
                <TouchableOpacity
                  key={t}
                  style={[styles.typeChip, debtType === t && styles.typeChipActive]}
                  onPress={() => setDebtType(t)}
                >
                  <Text style={styles.typeChipEmoji}>{DEBT_TYPES[t].emoji}</Text>
                  <Text style={[styles.typeChipLabel, debtType === t && styles.typeChipLabelActive]}>
                    {DEBT_TYPES[t].label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Name</Text>
            <TextInput style={styles.input} value={label} onChangeText={setLabel} placeholder="e.g. Car loan" placeholderTextColor={Colors.textTertiary} />

            <Text style={styles.fieldLabel}>Lender / person (optional)</Text>
            <TextInput style={styles.input} value={lenderName} onChangeText={setLenderName} placeholder="e.g. Fidelity Bank" placeholderTextColor={Colors.textTertiary} />

            <Text style={styles.fieldLabel}>Original amount ({currency})</Text>
            <TextInput style={styles.input} value={principalInput} onChangeText={setPrincipalInput} placeholder="0.00" placeholderTextColor={Colors.textTertiary} keyboardType="decimal-pad" />

            <Text style={styles.fieldLabel}>Current balance ({currency})</Text>
            <TextInput style={styles.input} value={balanceInput} onChangeText={setBalanceInput} placeholder="Same as original if new" placeholderTextColor={Colors.textTertiary} keyboardType="decimal-pad" />

            <Text style={styles.fieldLabel}>Interest rate % (optional)</Text>
            <TextInput style={styles.input} value={interestInput} onChangeText={setInterestInput} placeholder="0" placeholderTextColor={Colors.textTertiary} keyboardType="decimal-pad" />

            <Text style={styles.fieldLabel}>Minimum monthly payment (optional)</Text>
            <TextInput style={styles.input} value={minPaymentInput} onChangeText={setMinPaymentInput} placeholder="0.00" placeholderTextColor={Colors.textTertiary} keyboardType="decimal-pad" />

            <Text style={styles.fieldLabel}>Due day of month (optional)</Text>
            <TextInput style={styles.input} value={dueDayInput} onChangeText={setDueDayInput} placeholder="e.g. 15" placeholderTextColor={Colors.textTertiary} keyboardType="number-pad" />

            <Button label={saving ? 'Saving...' : 'Save'} onPress={handleSaveForm} loading={saving} fullWidth style={{ marginTop: Spacing.md }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ── Record Payment Modal ── */}
      <Modal visible={!!payingDebt} transparent animationType="slide" onRequestClose={() => setPayingDebt(null)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TouchableOpacity style={styles.modalOverlayTouch} activeOpacity={1} onPress={() => setPayingDebt(null)}>
            <TouchableOpacity activeOpacity={1} onPress={() => {}} style={styles.modalCard}>
              <Text style={styles.modalCardTitle}>Record a Payment</Text>
              <Text style={styles.modalCardSub}>{payingDebt?.label} — {payingDebt && formatCurrency(payingDebt.currentBalance, currency)} remaining</Text>
              <Text style={styles.fieldLabel}>Amount ({currency})</Text>
              <TextInput
                style={styles.input}
                value={paymentInput}
                onChangeText={setPaymentInput}
                placeholder="0.00"
                placeholderTextColor={Colors.textTertiary}
                keyboardType="decimal-pad"
                autoFocus
              />
              <View style={styles.modalCardActions}>
                <Button label="Cancel" onPress={() => setPayingDebt(null)} variant="outline" style={{ flex: 1 }} />
                <Button label="Save" onPress={handleRecordPayment} loading={payingSaving} style={{ flex: 1 }} />
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

  hero:        { flexDirection: 'row', borderRadius: Radius.xl, padding: Spacing.lg, ...Shadows.primary },
  heroStat:    { flex: 1, gap: 4 },
  heroLabel:   { fontSize: Typography.sm, color: 'rgba(255,255,255,0.75)', fontWeight: Typography.medium },
  heroAmount:  { fontSize: Typography.xxl, fontWeight: Typography.bold, color: '#fff', letterSpacing: -0.5 },
  heroDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginHorizontal: Spacing.base },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle:  { fontSize: Typography.base, fontWeight: Typography.bold, color: Colors.text },
  addBtn:        { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primary, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Radius.full },
  addBtnText:    { color: '#fff', fontSize: Typography.sm, fontWeight: Typography.semibold },

  emptyCard:  { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xl },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.text },
  emptySub:   { fontSize: Typography.sm, color: Colors.textSecondary, textAlign: 'center' },
  emptyBtn:   { backgroundColor: Colors.primary, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: Radius.full, marginTop: Spacing.sm },
  emptyBtnText: { color: '#fff', fontWeight: Typography.semibold },

  debtCard:   { gap: Spacing.sm },
  debtHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  debtEmoji:  { fontSize: 26 },
  debtInfo:   { flex: 1 },
  debtLabel:  { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.text },
  debtSub:    { fontSize: Typography.xs, color: Colors.textSecondary, marginTop: 2 },
  iconBtn:    { padding: Spacing.xs },

  balanceRow:   { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.xs },
  balanceValue: { fontSize: Typography.xl, fontWeight: Typography.bold, color: Colors.text },
  balanceSub:   { fontSize: Typography.xs, color: Colors.textTertiary },

  barTrack: { height: 6, borderRadius: 3, backgroundColor: Colors.border, overflow: 'hidden' },
  barFill:  { height: '100%', backgroundColor: Colors.success, borderRadius: 3 },
  paidOffText: { fontSize: Typography.xs, color: Colors.textSecondary },

  metaRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  metaChip: { fontSize: Typography.xs, color: Colors.textSecondary, backgroundColor: Colors.surfaceAlt, paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.full },

  paidCard:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, opacity: 0.7 },
  paidEmoji: { fontSize: 22 },

  // Add/Edit form (page sheet)
  formModal:   { flex: 1, backgroundColor: Colors.background },
  formHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.base, borderBottomWidth: 1, borderBottomColor: Colors.border },
  formTitle:   { fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.text },
  formContent: { padding: Spacing.base, gap: Spacing.base, paddingBottom: Spacing.xxxl },

  fieldLabel: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.text },
  input:      { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.base, fontSize: Typography.base, color: Colors.text, borderWidth: 1.5, borderColor: Colors.border },

  typeGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  typeChip:  { width: '47%', flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, padding: Spacing.sm, borderRadius: Radius.md, backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: Colors.border },
  typeChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '10' },
  typeChipEmoji:  { fontSize: 18 },
  typeChipLabel:  { fontSize: Typography.sm, color: Colors.textSecondary, flexShrink: 1 },
  typeChipLabelActive: { color: Colors.primary, fontWeight: Typography.semibold },

  // Record payment modal (compact bottom sheet)
  modalOverlay:      { flex: 1 },
  modalOverlayTouch: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard:         { backgroundColor: Colors.surface, borderTopLeftRadius: Radius.xxl, borderTopRightRadius: Radius.xxl, padding: Spacing.xl, gap: Spacing.md },
  modalCardTitle:    { fontSize: Typography.xl, fontWeight: Typography.bold, color: Colors.text },
  modalCardSub:      { fontSize: Typography.sm, color: Colors.textSecondary, marginTop: -Spacing.xs },
  modalCardActions:  { flexDirection: 'row', gap: Spacing.md },
});
