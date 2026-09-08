import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '@/store/authStore';
import { Colors, Typography, Spacing, Radius } from '@/theme';
import type { AuthNavProp } from '@/navigation/types';

export function SplashScreen() {
  const nav     = useNavigation<AuthNavProp>();
  const session = useAuthStore(s => s.session);
  const loading = useAuthStore(s => s.loading);

  // useRef so these are created once, not recreated on every render.
  const logoScale   = useRef(new Animated.Value(0.6)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;

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
        <Ionicons name="wallet" size={44} color="#fff" />
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
  logo:      {
    width: 96, height: 96, borderRadius: Radius.full, backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center', justifyContent: 'center',
  },
  appName:   { fontSize: Typography.xxl, fontWeight: Typography.bold,  color: '#fff', letterSpacing: -0.5 },
  tagline:   { fontSize: Typography.base, color: 'rgba(255,255,255,0.80)', fontWeight: Typography.medium },
});
