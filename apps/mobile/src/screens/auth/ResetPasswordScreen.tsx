import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { Button, Input } from '@/components/ui';
import { Colors, Typography, Spacing, Radius } from '@/theme';

/**
 * Shown in place of the normal app/auth flow whenever
 * authStore.passwordRecoveryPending is true — see RootNavigator. The user
 * arrived here via the email link from ForgotPasswordScreen, which already
 * gave them a real (if narrowly-scoped) Supabase session; this screen's only
 * job is collecting the new password before letting them into the app.
 */
export function ResetPasswordScreen() {
  const setPasswordRecoveryPending = useAuthStore(s => s.setPasswordRecoveryPending);

  const [newPassword,     setNewPassword]     = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving,           setSaving]          = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError,  setConfirmError]  = useState<string | null>(null);
  const [formError,     setFormError]     = useState<string | null>(null);

  const handleSave = async () => {
    setPasswordError(null);
    setConfirmError(null);
    setFormError(null);
    if (newPassword.length < 8) { setPasswordError('Password must be at least 8 characters.'); return; }
    if (newPassword !== confirmPassword) { setConfirmError('Passwords do not match.'); return; }

    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      // Only now does RootNavigator's guard drop and route the user into the
      // app as normally logged in — with the password they just set.
      setPasswordRecoveryPending(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.iconBg}>
            <Ionicons name="lock-closed-outline" size={32} color={Colors.primary} />
          </View>
          <Text style={styles.title}>Set a new password</Text>
          <Text style={styles.subtitle}>Choose a new password for your account.</Text>
        </View>

        <View style={styles.form}>
          <Input
            label="New password"
            placeholder="At least 8 characters"
            value={newPassword}
            onChangeText={setNewPassword}
            isPassword
            leftIcon="lock-closed-outline"
            error={passwordError ?? undefined}
          />
          <Input
            label="Confirm new password"
            placeholder="Repeat your new password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            isPassword
            leftIcon="lock-closed-outline"
            error={confirmError ?? undefined}
          />
          {formError && <Text style={styles.formError}>{formError}</Text>}
          <Button label="Save new password" onPress={handleSave} loading={saving} fullWidth size="lg" />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex:      { flex: 1, backgroundColor: Colors.background },
  container: { flexGrow: 1, padding: Spacing.lg, justifyContent: 'center', gap: Spacing.xl },
  header:    { alignItems: 'center', gap: Spacing.sm },
  iconBg:    { width: 72, height: 72, borderRadius: Radius.full, backgroundColor: Colors.primary + '12', alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.xs },
  title:     { fontSize: Typography.xxl, fontWeight: Typography.bold, color: Colors.text, textAlign: 'center' },
  subtitle:  { fontSize: Typography.base, color: Colors.textSecondary, textAlign: 'center' },
  form:      { gap: Spacing.md, backgroundColor: Colors.surface, padding: Spacing.lg, borderRadius: Radius.xl },
  formError: { fontSize: Typography.sm, color: Colors.danger, textAlign: 'center' },
});
