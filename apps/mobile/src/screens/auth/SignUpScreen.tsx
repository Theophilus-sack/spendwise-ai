import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '@/lib/supabase';
import { Button, Input } from '@/components/ui';
import { Colors, Typography, Spacing, Radius } from '@/theme';
import type { AuthNavProp } from '@/navigation/types';

export function SignUpScreen() {
  const nav = useNavigation<AuthNavProp>();

  const [fullName, setFullName] = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [loading,  setLoading]  = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError,  setConfirmError]  = useState<string | null>(null);
  const [formError,     setFormError]     = useState<string | null>(null);

  const handleSignUp = async () => {
    if (!fullName.trim() || !email.trim() || !password) return;
    setPasswordError(null);
    setConfirmError(null);
    setFormError(null);
    if (password !== confirm) { setConfirmError('Passwords do not match'); return; }
    if (password.length < 8)  { setPasswordError('Password must be at least 8 characters'); return; }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: fullName.trim() } },
      });
      if (error) setFormError(error.message);
      else Alert.alert('Check your email', 'We sent you a confirmation link.', [
        { text: 'OK', onPress: () => nav.navigate('Login') },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.emoji}>🚀</Text>
          <Text style={styles.title}>Create your account</Text>
          <Text style={styles.subtitle}>Start your journey to financial discipline</Text>
        </View>

        <View style={styles.form}>
          <Input
            label="Full name"
            placeholder="Kofi Mensah"
            value={fullName}
            onChangeText={setFullName}
            leftIcon="person-outline"
            autoCapitalize="words"
          />
          <Input
            label="Email address"
            placeholder="you@example.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            leftIcon="mail-outline"
          />
          <Input
            label="Password"
            placeholder="At least 8 characters"
            value={password}
            onChangeText={setPassword}
            isPassword
            leftIcon="lock-closed-outline"
            error={passwordError ?? undefined}
          />
          <Input
            label="Confirm password"
            placeholder="Repeat your password"
            value={confirm}
            onChangeText={setConfirm}
            isPassword
            leftIcon="lock-closed-outline"
            error={confirmError ?? undefined}
          />
          {formError && <Text style={styles.formError}>{formError}</Text>}
          <Button label="Create Account" onPress={handleSignUp} loading={loading} fullWidth size="lg" />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => nav.navigate('Login')}>
            <Text style={styles.link}>Sign in</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex:       { flex: 1, backgroundColor: Colors.background },
  container:  { flexGrow: 1, padding: Spacing.lg, justifyContent: 'center', gap: Spacing.xl },
  header:     { alignItems: 'center', gap: Spacing.sm },
  emoji:      { fontSize: 52 },
  title:      { fontSize: Typography.xxl, fontWeight: Typography.bold, color: Colors.text },
  subtitle:   { fontSize: Typography.base, color: Colors.textSecondary, textAlign: 'center' },
  form:       { gap: Spacing.md, backgroundColor: Colors.surface, padding: Spacing.lg, borderRadius: Radius.xl },
  footer:     { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  footerText: { fontSize: Typography.base, color: Colors.textSecondary },
  link:       { fontSize: Typography.base, color: Colors.primary, fontWeight: Typography.semibold },
  formError:  { fontSize: Typography.sm, color: Colors.danger, textAlign: 'center' },
});
