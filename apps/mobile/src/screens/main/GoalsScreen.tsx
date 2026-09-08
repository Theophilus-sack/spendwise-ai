import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal,
  TextInput, Alert, RefreshControl, Animated, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { useGoalStore } from '@/store/goalStore';
import { Card, EmptyState } from '@/components/ui';
import { ConceptIcons } from '@/lib/iconMap';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/theme';
import { formatCurrency, generateUUID } from '@spendwise/shared';
import type { Goal } from '@spendwise/shared';

const EMOJI_OPTIONS = ['🏠', '🚗', '✈️', '📱', '💍', '🎓', '💰', '🏖️', '🎯', '👶', '🏥', '💻'];

export function GoalsScreen() {
  const { user, profile } = useAuthStore();
  const { goals, loading, load, addGoal, updateGoal, deleteGoal, contributeToGoal } = useGoalStore();

  const [showAddModal,    setShowAddModal]    = useState(false);
  const [showContribModal, setShowContribModal] = useState(false);
  const [selectedGoal,    setSelectedGoal]    = useState<Goal | null>(null);
  const [editingGoal,     setEditingGoal]     = useState<Goal | null>(null);
  const [title,           setTitle]           = useState('');
  const [targetAmount,    setTargetAmount]    = useState('');
  const [selectedEmoji,   setSelectedEmoji]   = useState('🎯');
  const [deadline,        setDeadline]        = useState('');
  const [contribAmount,   setContribAmount]   = useState('');
  const [saving,          setSaving]          = useState(false);

  // Pulsing reminder animation
  const reminderPulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(reminderPulse, { toValue: 1.025, duration: 1100, useNativeDriver: true }),
        Animated.timing(reminderPulse, { toValue: 1,     duration: 1100, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const currency = profile?.currency ?? 'GHS';

  const refresh = useCallback(async () => {
    if (user) await load(user.id);
  }, [user]);

  useEffect(() => { refresh(); }, []);

  const activeGoals    = goals.filter(g => g.status === 'active');
  const completedGoals = goals.filter(g => g.status === 'completed');
  const totalTarget    = activeGoals.reduce((s, g) => s + g.targetAmount, 0);
  const totalSaved     = activeGoals.reduce((s, g) => s + g.currentAmount, 0);
  const overallPct     = totalTarget > 0 ? Math.min((totalSaved / totalTarget) * 100, 100) : 0;

  // Days until nearest deadline
  const nearestDeadline = activeGoals
    .filter(g => g.deadline)
    .sort((a, b) => (a.deadline! > b.deadline! ? 1 : -1))[0];
  const daysLeft = nearestDeadline?.deadline
    ? Math.max(0, Math.ceil((new Date(nearestDeadline.deadline).getTime() - Date.now()) / 86400000))
    : null;

  const resetGoalForm = () => {
    setEditingGoal(null);
    setTitle('');
    setTargetAmount('');
    setDeadline('');
    setSelectedEmoji('🎯');
  };

  const openAddModal = () => {
    resetGoalForm();
    setShowAddModal(true);
  };

  // Tapping a goal card, or its edit icon, opens the same modal pre-filled —
  // updateGoal already existed in the store but had no UI calling it for
  // this purpose (only contributeToGoal used it, to bump currentAmount).
  const openEditModal = (goal: Goal) => {
    setEditingGoal(goal);
    setTitle(goal.title);
    setTargetAmount(goal.targetAmount.toString());
    setDeadline(goal.deadline ?? '');
    setSelectedEmoji(goal.emoji);
    setShowAddModal(true);
  };

  const closeAddModal = () => {
    setShowAddModal(false);
    resetGoalForm();
  };

  const handleSaveGoal = async () => {
    const amt = parseFloat(targetAmount);
    if (!title.trim() || !amt || amt <= 0) { Alert.alert('Please fill in title and a valid target amount'); return; }
    setSaving(true);
    try {
      if (editingGoal) {
        await updateGoal({
          ...editingGoal,
          title:        title.trim(),
          emoji:        selectedEmoji,
          targetAmount: amt,
          deadline:     deadline || undefined,
          updatedAt:    new Date().toISOString(),
        });
      } else {
        const now = new Date().toISOString();
        const goal: Goal = {
          id:            generateUUID(),
          userId:        user!.id,
          title:         title.trim(),
          emoji:         selectedEmoji,
          targetAmount:  amt,
          currentAmount: 0,
          deadline:      deadline || undefined,
          priority:      activeGoals.length + 1,
          roundupEnabled: false,
          status:        'active',
          createdAt:     now,
          updatedAt:     now,
        };
        await addGoal(goal);
      }
      setShowAddModal(false);
      resetGoalForm();
    } catch (err) {
      Alert.alert('Could not save', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleContribute = async () => {
    const amt = parseFloat(contribAmount);
    if (!selectedGoal || !amt || amt <= 0) { Alert.alert('Enter a valid amount'); return; }
    setSaving(true);
    try {
      await contributeToGoal(selectedGoal.id, amt);
      setShowContribModal(false);
      setContribAmount('');
      setSelectedGoal(null);
    } catch (err) {
      Alert.alert('Could not save', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const openContrib = (goal: Goal) => {
    setSelectedGoal(goal);
    setContribAmount('');
    setShowContribModal(true);
  };

  const confirmDeleteGoal = (goal: Goal) => {
    Alert.alert(
      'Delete this goal?',
      `Remove "${goal.title}"? This won't affect any expenses or income already logged.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive', onPress: () => {
            deleteGoal(goal.id).catch(err => {
              Alert.alert('Could not delete', err instanceof Error ? err.message : 'Please try again.');
            });
          },
        },
      ],
    );
  };

  const progressColor = (pct: number) =>
    pct >= 100 ? Colors.success : pct >= 60 ? Colors.primary : pct >= 30 ? Colors.warning : Colors.danger;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={Colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={styles.pageHeader}>
          <View>
            <Text style={styles.pageTitle}>Savings Goals</Text>
            <Text style={styles.pageSub}>{activeGoals.length} active goal{activeGoals.length !== 1 ? 's' : ''}</Text>
          </View>
          <TouchableOpacity style={styles.addBtn} onPress={openAddModal}>
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={styles.addBtnText}>New Goal</Text>
          </TouchableOpacity>
        </View>

        {/* ── Overall progress ── */}
        {activeGoals.length > 0 && (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Total progress across all goals</Text>
            <Text style={styles.summaryAmount}>{formatCurrency(totalSaved, currency)}</Text>
            <Text style={styles.summaryOf}>of {formatCurrency(totalTarget, currency)}</Text>
            <View style={styles.summaryTrack}>
              <View style={[styles.summaryFill, { width: `${overallPct}%` as any }]} />
            </View>
            <Text style={styles.summaryPct}>{overallPct.toFixed(0)}% of total target saved</Text>
          </View>
        )}

        {/* ── Savings reminder (pulsing) ── */}
        {activeGoals.length > 0 && (
          <Animated.View style={{ transform: [{ scale: reminderPulse }] }}>
            <Card style={styles.reminderCard}>
              <View style={styles.reminderLeft}>
                <View style={styles.reminderIconBg}>
                  <Ionicons name="notifications-outline" size={18} color={Colors.primary} />
                </View>
                <View>
                  <Text style={styles.reminderTitle}>Savings Reminder</Text>
                  <Text style={styles.reminderBody}>
                    {nearestDeadline && daysLeft !== null
                      ? `"${nearestDeadline.title}" deadline in ${daysLeft} day${daysLeft !== 1 ? 's' : ''} — add to it today`
                      : `Don't forget to contribute to your goals today. Small amounts add up.`}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.reminderBtn}
                onPress={() => nearestDeadline ? openContrib(nearestDeadline) : openAddModal()}
              >
                <Text style={styles.reminderBtnText}>Save now</Text>
              </TouchableOpacity>
            </Card>
          </Animated.View>
        )}

        {/* ── Active goals ── */}
        {activeGoals.length === 0 ? (
          <EmptyState
            icon={<Ionicons name={ConceptIcons.goals} size={28} color={Colors.primary} />}
            title="No active goals"
            description="Set a savings goal — a new phone, a trip, an emergency fund — and track your progress here."
            action={{ label: 'Create first goal', onPress: openAddModal }}
          />
        ) : (
          <>
            <Text style={styles.sectionTitle}>Active Goals</Text>
            {activeGoals.map(goal => {
              const pct     = goal.targetAmount > 0 ? Math.min((goal.currentAmount / goal.targetAmount) * 100, 100) : 0;
              const color   = progressColor(pct);
              const daysTo  = goal.deadline
                ? Math.max(0, Math.ceil((new Date(goal.deadline).getTime() - Date.now()) / 86400000))
                : null;
              const remaining = goal.targetAmount - goal.currentAmount;

              return (
                <TouchableOpacity key={goal.id} onPress={() => openEditModal(goal)} activeOpacity={0.85}>
                  <Card style={styles.goalCard}>
                    <View style={styles.goalHeader}>
                      <Text style={styles.goalEmoji}>{goal.emoji}</Text>
                      <View style={styles.goalInfo}>
                        <Text style={styles.goalTitle}>{goal.title}</Text>
                        {daysTo !== null && (
                          <Text style={[styles.goalDeadline, { color: daysTo < 7 ? Colors.danger : Colors.textSecondary }]}>
                            {daysTo === 0 ? 'Due today' : `${daysTo} days left`}
                          </Text>
                        )}
                      </View>
                      <Text style={[styles.goalPct, { color }]}>{pct.toFixed(0)}%</Text>
                      <TouchableOpacity onPress={() => openEditModal(goal)} style={styles.editBtn} hitSlop={8}>
                        <Ionicons name="pencil-outline" size={16} color={Colors.textTertiary} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => confirmDeleteGoal(goal)} style={styles.deleteBtn} hitSlop={8}>
                        <Ionicons name="trash-outline" size={16} color={Colors.textTertiary} />
                      </TouchableOpacity>
                    </View>

                    {/* Progress bar */}
                    <View style={styles.progressTrack}>
                      <Animated.View style={[styles.progressFill, { width: `${pct}%` as any, backgroundColor: color }]} />
                    </View>

                    <View style={styles.goalAmounts}>
                      <Text style={styles.goalSaved}>{formatCurrency(goal.currentAmount, currency)} saved</Text>
                      <Text style={styles.goalRemaining}>{formatCurrency(remaining, currency)} to go</Text>
                    </View>

                    {/* Target */}
                    <View style={styles.goalTarget}>
                      <Ionicons name="flag-outline" size={14} color={Colors.textSecondary} />
                      <Text style={styles.goalTargetText}>Target: {formatCurrency(goal.targetAmount, currency)}</Text>
                    </View>

                    <TouchableOpacity style={styles.contributeBtn} onPress={() => openContrib(goal)}>
                      <Ionicons name="add-circle-outline" size={16} color="#fff" />
                      <Text style={styles.contributeBtnText}>Add savings</Text>
                    </TouchableOpacity>
                  </Card>
                </TouchableOpacity>
              );
            })}
          </>
        )}

        {/* ── Completed goals ── */}
        {completedGoals.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Completed</Text>
            {completedGoals.map(goal => (
              <Card key={goal.id} style={[styles.goalCard, styles.goalCardDone]}>
                <View style={styles.goalHeader}>
                  <Text style={styles.goalEmoji}>{goal.emoji}</Text>
                  <View style={styles.goalInfo}>
                    <Text style={styles.goalTitle}>{goal.title}</Text>
                    <Text style={{ fontSize: Typography.xs, color: Colors.success, fontWeight: Typography.semibold }}>Goal reached</Text>
                  </View>
                  <Ionicons name="checkmark-circle" size={24} color={Colors.success} />
                  <TouchableOpacity onPress={() => confirmDeleteGoal(goal)} style={styles.deleteBtn} hitSlop={8}>
                    <Ionicons name="trash-outline" size={16} color={Colors.textTertiary} />
                  </TouchableOpacity>
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: '100%', backgroundColor: Colors.success }]} />
                </View>
                <Text style={styles.goalSaved}>{formatCurrency(goal.currentAmount, currency)} saved</Text>
              </Card>
            ))}
          </>
        )}
      </ScrollView>

      {/* ── Add / Edit Goal Modal ── */}
      <Modal visible={showAddModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeAddModal}>
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{editingGoal ? 'Edit Goal' : 'New Savings Goal'}</Text>
            <TouchableOpacity onPress={closeAddModal}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <Text style={styles.fieldLabel}>Choose an emoji</Text>
            <View style={styles.emojiGrid}>
              {EMOJI_OPTIONS.map(e => (
                <TouchableOpacity
                  key={e}
                  style={[styles.emojiBtn, selectedEmoji === e && styles.emojiBtnActive]}
                  onPress={() => setSelectedEmoji(e)}
                >
                  <Text style={{ fontSize: 24 }}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Goal name</Text>
            <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="e.g. New laptop" placeholderTextColor={Colors.textTertiary} />

            <Text style={styles.fieldLabel}>Target amount ({(profile?.currency ?? 'GHS')})</Text>
            <TextInput style={styles.input} value={targetAmount} onChangeText={setTargetAmount} placeholder="0.00" keyboardType="decimal-pad" placeholderTextColor={Colors.textTertiary} />

            <Text style={styles.fieldLabel}>Deadline (optional, YYYY-MM-DD)</Text>
            <TextInput style={styles.input} value={deadline} onChangeText={setDeadline} placeholder="2026-12-31" placeholderTextColor={Colors.textTertiary} />

            <TouchableOpacity style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={handleSaveGoal} disabled={saving}>
              <Text style={styles.saveBtnText}>{saving ? 'Saving...' : editingGoal ? 'Save Changes' : 'Create Goal'}</Text>
            </TouchableOpacity>
          </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* ── Contribute Modal ── */}
      <Modal visible={showContribModal} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setShowContribModal(false)}>
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {selectedGoal ? `Save to "${selectedGoal.title}"` : 'Add savings'}
            </Text>
            <TouchableOpacity onPress={() => setShowContribModal(false)}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalContent}>
            {selectedGoal && (
              <Card style={styles.contribProgress}>
                <Text style={styles.contribCurrent}>{formatCurrency(selectedGoal.currentAmount, currency)}</Text>
                <Text style={styles.contribOf}>of {formatCurrency(selectedGoal.targetAmount, currency)} goal</Text>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, {
                    width: `${Math.min((selectedGoal.currentAmount / selectedGoal.targetAmount) * 100, 100)}%` as any,
                    backgroundColor: Colors.primary,
                  }]} />
                </View>
              </Card>
            )}
            <Text style={styles.fieldLabel}>Amount to add ({(profile?.currency ?? 'GHS')})</Text>
            <TextInput
              style={styles.input}
              value={contribAmount}
              onChangeText={setContribAmount}
              placeholder="0.00"
              keyboardType="decimal-pad"
              placeholderTextColor={Colors.textTertiary}
              autoFocus
            />
            <TouchableOpacity style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={handleContribute} disabled={saving}>
              <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Add to Goal'}</Text>
            </TouchableOpacity>
          </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.base, gap: Spacing.base, paddingBottom: Spacing.xxxl },

  pageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  pageTitle:  { fontSize: Typography.xl, fontWeight: Typography.bold, color: Colors.text },
  pageSub:    { fontSize: Typography.sm, color: Colors.textSecondary, marginTop: 2 },
  addBtn:     { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primary, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.full, ...Shadows.sm },
  addBtnText: { color: '#fff', fontSize: Typography.sm, fontWeight: Typography.semibold },

  summaryCard:    {
    borderRadius: Radius.xl, padding: Spacing.lg, alignItems: 'center', gap: Spacing.xs,
    backgroundColor: Colors.surface, borderLeftWidth: 4, borderLeftColor: Colors.primary, ...Shadows.sm,
  },
  summaryLabel:   { fontSize: Typography.sm, color: Colors.textSecondary },
  summaryAmount:  { fontSize: Typography.xxxl, fontWeight: Typography.bold, color: Colors.text },
  summaryOf:      { fontSize: Typography.sm, color: Colors.textTertiary },
  summaryTrack:   { width: '100%', height: 8, borderRadius: Radius.full, backgroundColor: Colors.border, overflow: 'hidden' },
  summaryFill:    { height: 8, borderRadius: Radius.full, backgroundColor: Colors.primary },
  summaryPct:     { fontSize: Typography.xs, color: Colors.primary, fontWeight: Typography.medium },

  reminderCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderColor: Colors.primary + '30', borderWidth: 1, backgroundColor: Colors.primary + '06' },
  reminderLeft: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  reminderIconBg:{ width: 36, height: 36, borderRadius: Radius.full, backgroundColor: Colors.primary + '12', alignItems: 'center', justifyContent: 'center' },
  reminderTitle:{ fontSize: Typography.sm, fontWeight: Typography.bold, color: Colors.primary },
  reminderBody: { fontSize: Typography.xs, color: Colors.textSecondary, marginTop: 2, lineHeight: 18, flex: 1, flexWrap: 'wrap' },
  reminderBtn:  { backgroundColor: Colors.primary, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Radius.full },
  reminderBtnText: { color: '#fff', fontSize: Typography.xs, fontWeight: Typography.bold },

  sectionTitle: { fontSize: Typography.base, fontWeight: Typography.bold, color: Colors.text },

  goalCard:     { gap: Spacing.sm },
  goalCardDone: { opacity: 0.8 },
  goalHeader:   { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  goalEmoji:    { fontSize: 28 },
  goalInfo:     { flex: 1 },
  goalTitle:    { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.text },
  goalDeadline: { fontSize: Typography.xs, marginTop: 2 },
  goalPct:      { fontSize: Typography.lg, fontWeight: Typography.bold },
  editBtn:      { padding: 4 },
  deleteBtn:    { padding: 4 },

  progressTrack: { height: 10, borderRadius: Radius.full, backgroundColor: Colors.border, overflow: 'hidden' },
  progressFill:  { height: 10, borderRadius: Radius.full },

  goalAmounts:   { flexDirection: 'row', justifyContent: 'space-between' },
  goalSaved:     { fontSize: Typography.sm, color: Colors.text, fontWeight: Typography.semibold },
  goalRemaining: { fontSize: Typography.sm, color: Colors.textSecondary },

  goalTarget:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  goalTargetText: { fontSize: Typography.xs, color: Colors.textSecondary },

  contributeBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, backgroundColor: Colors.primary, borderRadius: Radius.lg, padding: Spacing.sm },
  contributeBtnText: { color: '#fff', fontSize: Typography.sm, fontWeight: Typography.semibold },


  modal:        { flex: 1, backgroundColor: Colors.background },
  modalHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.base, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalTitle:   { fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.text },
  modalContent: { padding: Spacing.base, gap: Spacing.base, paddingBottom: Spacing.xxxl },

  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  emojiBtn:      { width: 52, height: 52, borderRadius: Radius.md, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: Colors.border },
  emojiBtnActive:{ borderColor: Colors.primary, backgroundColor: Colors.primary + '12' },

  fieldLabel: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.text },
  input:      { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.base, fontSize: Typography.base, color: Colors.text, borderWidth: 1.5, borderColor: Colors.border },

  contribProgress: { alignItems: 'center', gap: Spacing.xs },
  contribCurrent:  { fontSize: Typography.xxl, fontWeight: Typography.bold, color: Colors.primary },
  contribOf:       { fontSize: Typography.sm, color: Colors.textSecondary },

  saveBtn:         { backgroundColor: Colors.primary, borderRadius: Radius.lg, padding: Spacing.base, alignItems: 'center', marginTop: Spacing.sm },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText:     { color: '#fff', fontSize: Typography.base, fontWeight: Typography.bold },
});
