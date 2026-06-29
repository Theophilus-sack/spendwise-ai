import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '@/store/authStore';
import { Card } from '@/components/ui';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/theme';
import type { AppStackNavProp } from '@/navigation/types';

export function ProfileScreen() {
  const { profile, signOut } = useAuthStore();
  const nav = useNavigation<AppStackNavProp>();

  const menuItems = [
    { icon: 'bar-chart-outline',   label: 'Analytics',        action: () => nav.navigate('Analytics') },
    { icon: 'trending-up-outline', label: 'Spending Forecast', action: () => nav.navigate('Forecast') },
    { icon: 'wallet-outline',      label: 'Income',           action: () => nav.navigate('Income') },
    { icon: 'card-outline',        label: 'Debts & Loans',    action: () => nav.navigate('Debts') },
    { icon: 'trophy-outline',      label: 'Achievements',     action: () => nav.navigate('Achievements') },
    { icon: 'shield-outline',      label: 'Discipline Score', action: () => nav.navigate('ScoreDetail') },
    { icon: 'git-compare-outline', label: 'What-If Simulator',action: () => nav.navigate('WhatIfSimulator') },
    { icon: 'share-outline',       label: 'Export Reports',   action: () => Alert.alert('Coming soon', 'PDF/CSV export in Phase 4') },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      {/* Profile Header */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{profile?.fullName?.charAt(0)?.toUpperCase() ?? '?'}</Text>
        </View>
        <View>
          <Text style={styles.name}>{profile?.fullName ?? 'User'}</Text>
          <Text style={styles.currency}>💰 {profile?.currency ?? 'GHS'} · {profile?.spendingPersonality ?? 'balanced'}</Text>
        </View>
      </View>

      {/* Menu */}
      <Card style={styles.menu}>
        {menuItems.map(({ icon, label, action }, i) => (
          <React.Fragment key={label}>
            <TouchableOpacity style={styles.menuItem} onPress={action} activeOpacity={0.7}>
              <View style={styles.menuIcon}>
                <Ionicons name={icon as any} size={20} color={Colors.primary} />
              </View>
              <Text style={styles.menuLabel}>{label}</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
            </TouchableOpacity>
            {i < menuItems.length - 1 && <View style={styles.divider} />}
          </React.Fragment>
        ))}
      </Card>

      <TouchableOpacity
        style={styles.signOutBtn}
        onPress={() => Alert.alert('Sign Out', 'Are you sure?', [
          { text: 'Cancel' },
          { text: 'Sign Out', style: 'destructive', onPress: signOut },
        ])}
      >
        <Ionicons name="log-out-outline" size={20} color={Colors.danger} />
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: Colors.background, padding: Spacing.base, gap: Spacing.base },
  header:    { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md },
  avatar:    { width: 60, height: 60, borderRadius: 30, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText:{ fontSize: Typography.xl, fontWeight: Typography.bold, color: '#fff' },
  name:      { fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.text },
  currency:  { fontSize: Typography.sm, color: Colors.textSecondary, marginTop: 2, textTransform: 'capitalize' },
  menu:      { gap: 0, padding: 0, overflow: 'hidden' },
  menuItem:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.base },
  menuIcon:  { width: 36, height: 36, borderRadius: Radius.md, backgroundColor: Colors.primary + '12', alignItems: 'center', justifyContent: 'center' },
  menuLabel: { flex: 1, fontSize: Typography.base, color: Colors.text, fontWeight: Typography.medium },
  divider:   { height: 1, backgroundColor: Colors.border, marginLeft: 68 },
  signOutBtn:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, padding: Spacing.base, marginTop: Spacing.sm },
  signOutText:{ fontSize: Typography.base, color: Colors.danger, fontWeight: Typography.semibold },
});
