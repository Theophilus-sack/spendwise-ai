import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { OnboardingWizard } from '@/screens/onboarding/OnboardingWizard';
import type { OnboardingStackParamList } from './types';

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

export function OnboardingNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="OnboardingWizard" component={OnboardingWizard} />
    </Stack.Navigator>
  );
}
