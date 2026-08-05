import React, { useEffect } from "react";
import { AppState } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { supabase } from "@/lib/supabase";
import { registerForPushNotifications, setupNotificationResponseHandling } from "@/lib/notifications";
import { flushQueue, startSyncListeners } from "@/lib/syncEngine";
import { useAuthStore } from "@/store/authStore";
import { AuthNavigator } from "./AuthNavigator";
import { OnboardingNavigator } from "./OnboardingNavigator";
import { AppNavigator } from "./AppNavigator";
import { ResetPasswordScreen } from "@/screens/auth/ResetPasswordScreen";
import { navigationRef } from "./navigationRef";
import { linking } from "./linking";
import type { RootStackParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { session, user, profile, loading, passwordRecoveryPending, setSession, setPasswordRecoveryPending, fetchProfile } =
    useAuthStore();

  useEffect(() => {
    // Bootstrap session from SecureStore
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProfile();
    });

    // Listen for auth state changes. A password-recovery email link
    // establishes a real session, but fires the distinct 'PASSWORD_RECOVERY'
    // event rather than 'SIGNED_IN' — that's the only way to tell "this
    // session exists so the user can set a new password" apart from a normal
    // login, which matters below so it doesn't just drop them into the app.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') setPasswordRecoveryPending(true);
      setSession(session);
      if (session) fetchProfile();
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => setupNotificationResponseHandling(), []);

  const needsOnboarding = session && profile && !profile.onboardingCompleted;
  const isAuthenticated = session && profile?.onboardingCompleted;

  // Every hook must run on every render regardless of `loading` — this used
  // to sit after the early return below, which meant React saw a different
  // number of hooks between the loading and loaded renders and threw
  // "Rendered more hooks than during the previous render."
  useEffect(() => {
    if (isAuthenticated && user) {
      registerForPushNotifications(user.id);
    }
  }, [isAuthenticated, user?.id]);

  // Offline-sync flush triggers: on launch (once authenticated), whenever
  // connectivity comes back, and whenever the app returns to the foreground.
  // Belt-and-suspenders on purpose — background network-change events are
  // unreliable enough across platforms that relying on just one is risky.
  useEffect(() => {
    if (!isAuthenticated) return;

    flushQueue();
    const unsubscribeReconnect = startSyncListeners();
    const appStateSubscription = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') flushQueue();
    });

    return () => {
      unsubscribeReconnect();
      appStateSubscription.remove();
    };
  }, [isAuthenticated]);

  if (loading) return null; // Splash screen handles this

  return (
    <NavigationContainer ref={navigationRef} linking={linking}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {passwordRecoveryPending ? (
          // Takes priority over everything else — a session existing here is
          // specifically the recovery link's session, not a normal login.
          <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
        ) : !session ? (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        ) : needsOnboarding ? (
          <Stack.Screen name="Onboarding" component={OnboardingNavigator} />
        ) : (
          <Stack.Screen name="App" component={AppNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
