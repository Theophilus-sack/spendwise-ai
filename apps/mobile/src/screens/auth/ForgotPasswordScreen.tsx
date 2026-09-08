import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { supabase } from '@/lib/supabase';
import { Button, Input } from '@/components/ui';
import { Colors, Typography, Spacing, Radius } from '@/theme';
import type { AuthNavProp } from '@/navigation/types';

export function ForgotPasswordScreen() {
  const nav = useNavigation<AuthNavProp>();

  const [email,   setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [formError,  setFormError]  = useState<string | null>(null);

  const handleSend = async () => {
    const trimmed = email.trim();
    setEmailError(null);
    setFormError(null);
    if (!trimmed || !trimmed.includes('@')) {
      setEmailError('Enter the email address on your account.');
      return;
    }
    setLoading(true);
    try {
      // Resolved dynamically rather than hardcoded so it works whether this
      // is running in Expo Go during dev (exp://...) or a standalone build
      // (spendwise://...) — same trick linking.ts's prefixes array uses.
      const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
        redirectTo: Linking.createURL('reset-password'),
      });
      if (error) throw error;
      setSent(true);
    } catch (err) {
      // Deliberately generic — confirming whether an email exists in the
      // system on a public form is an account-enumeration risk. Whether the
      // address is registered or not, the visible outcome is the same.
      setFormError(err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <TouchableOpacity style={styles.backBtn} onPress={() => nav.goBack()} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>

        <View style={styles.header}>
          <View style={styles.iconBg}>
            <Ionicons name={sent ? 'mail-outline' : 'key-outline'} size={32} color={Colors.primary} />
          </View>
          <Text style={styles.title}>{sent ? 'Check your inbox' : 'Reset your password'}</Text>
          <Text style={styles.subtitle}>
            {sent
              ? `If an account exists for ${email.trim()}, we've sent a link to reset your password. It expires shortly, so use it soon.`
              : "Enter the email on your account and we'll send you a link to set a new password."}
          </Text>
        </View>

        {!sent && (
          <View style={styles.form}>
            <Input
              label="Email address"
              placeholder="you@example.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              leftIcon="mail-outline"
              error={emailError ?? undefined}
            />
            {formError && <Text style={styles.formError}>{formError}</Text>}
            <Button label="Send reset link" onPress={handleSend} loading={loading} fullWidth size="lg" />
          </View>
        )}

        <View style={styles.footer}>
          <TouchableOpacity onPress={() => nav.navigate('Login')}>
            <Text style={styles.link}>Back to Sign In</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex:      { flex: 1, backgroundColor: Colors.background },
  container: { flexGrow: 1, padding: Spacing.lg, justifyContent: 'center', gap: Spacing.xl },
  backBtn:   { position: 'absolute', top: Spacing.lg, left: Spacing.lg, zIndex: 10 },
  header:    { alignItems: 'center', gap: Spacing.sm },
  iconBg:    { width: 72, height: 72, borderRadius: Radius.full, backgroundColor: Colors.primary + '12', alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.xs },
  title:     { fontSize: Typography.xxl, fontWeight: Typography.bold, color: Colors.text, textAlign: 'center' },
  subtitle:  { fontSize: Typography.base, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  form:      { gap: Spacing.md, backgroundColor: Colors.surface, padding: Spacing.lg, borderRadius: Radius.xl },
  footer:    { alignItems: 'center' },
  link:      { fontSize: Typography.base, color: Colors.primary, fontWeight: Typography.semibold },
  formError: { fontSize: Typography.sm, color: Colors.danger, textAlign: 'center' },
});
