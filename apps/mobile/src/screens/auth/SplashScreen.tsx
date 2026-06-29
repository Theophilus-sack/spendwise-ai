import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '@/store/authStore';
import { Colors, Typography, Spacing } from '@/theme';
import type { AuthNavProp } from '@/navigation/types';

export function SplashScreen() {
  const nav     = useNavigation<AuthNavProp>();
  const session = useAuthStore(s => s.session);
  const loading = useAuthStore(s => s.loading);

  const logoScale  = new Animated.Value(0.6);
  const logoOpacity = new Animated.Value(0);
  const textOpacity = new Animated.Value(0);

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale,  { toValue: 1,    useNativeDriver: true }),
        Animated.timing(logoOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]),
      Animated.timing(textOpacity, { toValue: 1, duration: 400, delay: 200, useNativeDriver: true }),
    ]).start(() => {
      // Navigate after 2.2 seconds total
      setTimeout(() => {
        if (!loading && !session) nav.replace('Login');
      }, 800);
    });
  }, [loading, session]);

  return (
    <LinearGradient
      colors={[Colors.primaryDark, Colors.primary, Colors.primaryLight]}
      style={styles.container}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
    >
      <Animated.View style={[styles.logo, { transform: [{ scale: logoScale }], opacity: logoOpacity }]}>
        <Text style={styles.logoIcon}>💸</Text>
      </Animated.View>
      <Animated.View style={{ opacity: textOpacity, alignItems: 'center', gap: Spacing.sm }}>
        <Text style={styles.appName}>SpendWise AI</Text>
        <Text style={styles.tagline}>Your AI-powered financial coach</Text>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.lg },
  logo:      { width: 96, height: 96, alignItems: 'center', justifyContent: 'center' },
  logoIcon:  { fontSize: 64 },
  appName:   { fontSize: Typography.xxl, fontWeight: Typography.bold,  color: '#fff', letterSpacing: -0.5 },
  tagline:   { fontSize: Typography.base, color: 'rgba(255,255,255,0.80)', fontWeight: Typography.medium },
});
