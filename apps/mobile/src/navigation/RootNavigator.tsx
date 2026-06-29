import React, { useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/authStore";
import { AuthNavigator } from "./AuthNavigator";
import { OnboardingNavigator } from "./OnboardingNavigator";
import { AppNavigator } from "./AppNavigator";
import type { RootStackParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { session, profile, loading, setSession, fetchProfile } =
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

  if (loading) return null; // Splash screen handles this

  const needsOnboarding = session && profile && !profile.onboardingCompleted;
  const isAuthenticated = session && profile?.onboardingCompleted;

  return (
    <NavigationContainer>
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
