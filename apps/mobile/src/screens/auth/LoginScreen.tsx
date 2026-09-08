import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { Button, Input } from '@/components/ui';
import { Colors, Typography, Spacing, Radius } from '@/theme';
import type { AuthNavProp } from '@/navigation/types';

export function LoginScreen() {
  const nav = useNavigation<AuthNavProp>();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email.trim() || !password) return;
    setFormError(null);
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) setFormError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconBg}>
            <Ionicons name="wallet-outline" size={32} color={Colors.primary} />
          </View>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to continue tracking your finances</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
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
            placeholder="Enter your password"
            value={password}
            onChangeText={setPassword}
            isPassword
            leftIcon="lock-closed-outline"
          />
          {formError && <Text style={styles.formError}>{formError}</Text>}
          <Button label="Sign In" onPress={handleLogin} loading={loading} fullWidth size="lg" />
          <TouchableOpacity onPress={() => nav.navigate('ForgotPassword')} style={styles.forgotBtn}>
            <Text style={styles.link}>Forgot password?</Text>
          </TouchableOpacity>
        </View>

        {/* Divider */}
        <View style={styles.divider}>
          <View style={styles.line} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.line} />
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <TouchableOpacity onPress={() => nav.navigate('SignUp')}>
            <Text style={styles.link}>Create one</Text>
          </TouchableOpacity>
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
  title:     { fontSize: Typography.xxl, fontWeight: Typography.bold, color: Colors.text },
  subtitle:  { fontSize: Typography.base, color: Colors.textSecondary, textAlign: 'center' },
  form:      { gap: Spacing.md, backgroundColor: Colors.surface, padding: Spacing.lg, borderRadius: Radius.xl },
  forgotBtn: { alignItems: 'center', paddingTop: Spacing.xs },
  formError: { fontSize: Typography.sm, color: Colors.danger, textAlign: 'center' },
  divider:   { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  line:      { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { fontSize: Typography.sm, color: Colors.textSecondary },
  footer:    { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  footerText:{ fontSize: Typography.base, color: Colors.textSecondary },
  link:      { fontSize: Typography.base, color: Colors.primary, fontWeight: Typography.semibold },
});
