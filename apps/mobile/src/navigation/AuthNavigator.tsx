import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SplashScreen }  from '@/screens/auth/SplashScreen';
import { LoginScreen }   from '@/screens/auth/LoginScreen';
import { SignUpScreen }  from '@/screens/auth/SignUpScreen';
import type { AuthStackParamList } from './types';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Splash"
      screenOptions={{ headerShown: false, animation: 'fade' }}
    >
      <Stack.Screen name="Splash"  component={SplashScreen} />
      <Stack.Screen name="Login"   component={LoginScreen} />
      <Stack.Screen name="SignUp"  component={SignUpScreen} />
    </Stack.Navigator>
  );
}
