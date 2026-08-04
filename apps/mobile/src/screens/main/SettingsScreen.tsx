import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView,
  Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { supabase, callEdgeFunction } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { useIsConnected } from '@/lib/connectivity';
import { getPendingSyncCount, flushQueue } from '@/lib/syncEngine';
import { Card, Button, Input } from '@/components/ui';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/theme';
import { CURRENCIES, SPENDING_PERSONALITIES, DISCIPLINE_STYLES } from '@spendwise/shared';
import type { Currency, SpendingPersonality, DisciplineStyle } from '@spendwise/shared';
import type { AppStackNavProp } from '@/navigation/types';

export function SettingsScreen() {
  const nav = useNavigation<AppStackNavProp>();
  const { user, profile, fetchProfile, signOut } = useAuthStore();

  // ── Sync status ──────────────────────────────────────────────────────────
  const isConnected = useIsConnected();
  const [pendingCount, setPendingCount] = useState(0);

  const refreshPendingCount = useCallback(() => {
    getPendingSyncCount().then(setPendingCount);
  }, []);

  useFocusEffect(useCallback(() => { refreshPendingCount(); }, [refreshPendingCount]));

  // ── Preferences ──────────────────────────────────────────────────────────
  const [currency,     setCurrency]     = useState<Currency>(profile?.currency ?? 'GHS');
  const [personality,  setPersonality]  = useState<SpendingPersonality>(profile?.spendingPersonality ?? 'balanced');
  const [discipline,   setDiscipline]   = useState<DisciplineStyle>(profile?.disciplineStyle ?? 'flexible');
  const [savingsPctInput, setSavingsPctInput] = useState(String(profile?.savingsTargetPct ?? 20));
  const [savingPrefs,  setSavingPrefs]  = useState(false);

  const handleSavePreferences = async () => {
    if (!user) return;
    const pct = parseFloat(savingsPctInput);
    if (isNaN(pct) || pct < 0 || pct > 100) {
      Alert.alert('Invalid value', 'Savings target must be a percentage between 0 and 100.');
      return;
    }
    setSavingPrefs(true);
    try {
      const { error } = await supabase.from('profiles').update({
        currency,
        spending_personality: personality,
        discipline_style:     discipline,
        savings_target_pct:   pct,
        updated_at: new Date().toISOString(),
      }).eq('user_id', user.id);
      if (error) throw error;
      await fetchProfile();
      Alert.alert('Saved', 'Your preferences have been updated.');
    } catch (err) {
      Alert.alert('Could not save', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setSavingPrefs(false);
    }
  };

  // ── Account security ─────────────────────────────────────────────────────
  const [newPassword,     setNewPassword]     = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword,  setSavingPassword]  = useState(false);

  const handleUpdatePassword = async () => {
    if (newPassword.length < 8) { Alert.alert('Too short', 'Password must be at least 8 characters.'); return; }
    if (newPassword !== confirmPassword) { Alert.alert('Mismatch', 'Passwords do not match.'); return; }

    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert('Password updated', 'Your password has been changed.');
    } catch (err) {
      Alert.alert('Could not update password', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setSavingPassword(false);
    }
  };

  const [newEmail,    setNewEmail]    = useState('');
  const [savingEmail, setSavingEmail] = useState(false);

  const handleUpdateEmail = async () => {
    const trimmed = newEmail.trim();
    if (!trimmed || !trimmed.includes('@')) { Alert.alert('Invalid email', 'Enter a valid email address.'); return; }

    setSavingEmail(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: trimmed });
      if (error) throw error;
      setNewEmail('');
      Alert.alert('Check your inbox', `We sent a confirmation link to ${trimmed}. Your email won't change until you confirm it.`);
    } catch (err) {
      Alert.alert('Could not update email', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setSavingEmail(false);
    }
  };

  // ── Danger zone ───────────────────────────────────────────────────────────
  const [deleting, setDeleting] = useState(false);

  const confirmDeleteAccount = () => {
    Alert.alert(
      'Delete your account?',
      'This permanently erases your account and every expense, budget, goal, income entry, and debt you\'ve tracked. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete Account', style: 'destructive', onPress: doDeleteAccount },
      ],
    );
  };

  const doDeleteAccount = async () => {
    setDeleting(true);
    try {
      await callEdgeFunction('delete-account');
      await signOut();
    } catch (err) {
      Alert.alert('Could not delete account', err instanceof Error ? err.message : 'Please try again.');
      setDeleting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

          {/* ── Sync status ── */}
          <Text style={styles.sectionTitle}>Sync Status</Text>
          <Card style={styles.card}>
            <View style={styles.syncRow}>
              <View style={[styles.syncDot, { backgroundColor: isConnected ? Colors.success : Colors.danger }]} />
              <Text style={styles.syncStatusText}>{isConnected ? 'Online' : 'Offline'}</Text>
            </View>
            {pendingCount > 0 ? (
              <>
                <Text style={styles.syncPendingText}>
                  {pendingCount} change{pendingCount !== 1 ? 's' : ''} not yet synced — nothing is lost, this will sync automatically once you're back online.
                </Text>
                {isConnected && (
                  <Button
                    label="Sync now"
                    variant="outline"
                    onPress={() => flushQueue().then(refreshPendingCount)}
                  />
                )}
              </>
            ) : (
              <Text style={styles.syncOkText}>Everything is synced.</Text>
            )}
          </Card>

          {/* ── Preferences ── */}
          <Text style={styles.sectionTitle}>Preferences</Text>
          <Card style={styles.card}>
            <Text style={styles.fieldLabel}>Currency</Text>
            <View style={styles.chipGrid}>
              {Object.entries(CURRENCIES).map(([code, { symbol }]) => (
                <TouchableOpacity
                  key={code}
                  style={[styles.chip, currency === code && styles.chipActive]}
                  onPress={() => setCurrency(code as Currency)}
                >
                  <Text style={[styles.chipText, currency === code && styles.chipTextActive]}>{symbol} {code}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Spending personality</Text>
            {SPENDING_PERSONALITIES.map(p => (
              <TouchableOpacity
                key={p.id}
                style={[styles.optionRow, personality === p.id && styles.optionRowActive]}
                onPress={() => setPersonality(p.id)}
              >
                <Text style={styles.optionEmoji}>{p.emoji}</Text>
                <View style={styles.optionInfo}>
                  <Text style={styles.optionLabel}>{p.label}</Text>
                  <Text style={styles.optionDesc}>{p.desc}</Text>
                </View>
              </TouchableOpacity>
            ))}

            <Text style={styles.fieldLabel}>Discipline style</Text>
            {DISCIPLINE_STYLES.map(d => (
              <TouchableOpacity
                key={d.id}
                style={[styles.optionRow, discipline === d.id && styles.optionRowActive]}
                onPress={() => setDiscipline(d.id)}
              >
                <Text style={styles.optionEmoji}>{d.emoji}</Text>
                <View style={styles.optionInfo}>
                  <Text style={styles.optionLabel}>{d.label}</Text>
                  <Text style={styles.optionDesc}>{d.desc}</Text>
                </View>
              </TouchableOpacity>
            ))}

            <Text style={styles.fieldLabel}>Savings target (% of income)</Text>
            <Input
              value={savingsPctInput}
              onChangeText={setSavingsPctInput}
              keyboardType="decimal-pad"
              placeholder="20"
            />

            <Button label="Save Preferences" onPress={handleSavePreferences} loading={savingPrefs} fullWidth />
          </Card>

          {/* ── Account security ── */}
          <Text style={styles.sectionTitle}>Account Security</Text>
          <Card style={styles.card}>
            <Text style={styles.fieldLabel}>Current email</Text>
            <Text style={styles.currentValue}>{user?.email ?? '—'}</Text>

            <Text style={styles.fieldLabel}>New email</Text>
            <Input
              value={newEmail}
              onChangeText={setNewEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              leftIcon="mail-outline"
            />
            <Button label="Update Email" onPress={handleUpdateEmail} loading={savingEmail} variant="outline" fullWidth />

            <View style={styles.divider} />

            <Text style={styles.fieldLabel}>New password</Text>
            <Input
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="At least 8 characters"
              isPassword
              leftIcon="lock-closed-outline"
            />
            <Text style={styles.fieldLabel}>Confirm new password</Text>
            <Input
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Repeat your new password"
              isPassword
              leftIcon="lock-closed-outline"
            />
            <Button label="Update Password" onPress={handleUpdatePassword} loading={savingPassword} variant="outline" fullWidth />
          </Card>

          {/* ── Danger zone ── */}
          <Text style={[styles.sectionTitle, styles.dangerTitle]}>Danger Zone</Text>
          <Card style={[styles.card, styles.dangerCard]}>
            <Text style={styles.dangerText}>
              Deleting your account is permanent. All your expenses, budgets, goals, income, debts, and AI conversation history will be erased immediately and cannot be recovered.
            </Text>
            <Button label="Delete Account" onPress={confirmDeleteAccount} loading={deleting} variant="danger" fullWidth />
          </Card>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.background },
  flex:    { flex: 1 },
  content: { padding: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing.xxxl },

  sectionTitle: { fontSize: Typography.sm, fontWeight: Typography.bold, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: Spacing.base, marginBottom: Spacing.xs },
  card:         { gap: Spacing.md },

  fieldLabel: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.text, marginTop: Spacing.xs },

  syncRow:         { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  syncDot:         { width: 9, height: 9, borderRadius: 5 },
  syncStatusText:  { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.text },
  syncPendingText: { fontSize: Typography.sm, color: Colors.textSecondary, lineHeight: Typography.sm * 1.4 },
  syncOkText:      { fontSize: Typography.sm, color: Colors.textSecondary },

  chipGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip:          { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surfaceAlt },
  chipActive:    { borderColor: Colors.primary, backgroundColor: Colors.primary + '18' },
  chipText:      { fontSize: Typography.sm, color: Colors.textSecondary, fontWeight: Typography.medium },
  chipTextActive:{ color: Colors.primary, fontWeight: Typography.semibold },

  optionRow:       { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, backgroundColor: Colors.surfaceAlt, borderRadius: Radius.lg, borderWidth: 1.5, borderColor: Colors.border },
  optionRowActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '08' },
  optionEmoji:     { fontSize: 24 },
  optionInfo:      { flex: 1 },
  optionLabel:     { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.text },
  optionDesc:      { fontSize: Typography.xs, color: Colors.textSecondary },

  currentValue: { fontSize: Typography.base, color: Colors.textSecondary },
  divider:      { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.xs },

  dangerTitle: { color: Colors.danger },
  dangerCard:  { borderWidth: 1, borderColor: Colors.dangerLight, ...Shadows.sm },
  dangerText:  { fontSize: Typography.sm, color: Colors.textSecondary, lineHeight: 20 },
});
