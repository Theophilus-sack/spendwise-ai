import React, { useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { supabase } from "@/lib/supabase";
import { registerForPushNotifications, setupNotificationResponseHandling } from "@/lib/notifications";
import { useAuthStore } from "@/store/authStore";
import { AuthNavigator } from "./AuthNavigator";
import { OnboardingNavigator } from "./OnboardingNavigator";
import { AppNavigator } from "./AppNavigator";
import { navigationRef } from "./navigationRef";
import { linking } from "./linking";
import type { RootStackParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { session, user, profile, loading, setSession, fetchProfile } =
    useAuthStore();

  useEffect(() => {
    // Bootstrap session from SecureStore
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProfile();
    });

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
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

  if (loading) return null; // Splash screen handles this

  return (
    <NavigationContainer ref={navigationRef} linking={linking}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!session ? (
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
