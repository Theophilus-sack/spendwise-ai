import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp, BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeNavigationProp } from '@react-navigation/native';

// ─── Stack Param Lists ────────────────────────────────────────────────────────

export type RootStackParamList = {
  Auth:       undefined;
  Onboarding: undefined;
  App:        undefined;
};

export type AuthStackParamList = {
  Splash:  undefined;
  Login:   undefined;
  SignUp:  undefined;
};

export type OnboardingStackParamList = {
  OnboardingWizard: undefined;
};

export type AppTabParamList = {
  Home:     undefined;
  Expenses: undefined;
  Budget:   undefined;
  Profile:  undefined;
};

export type AppStackParamList = {
  Tabs:              undefined;
  AddExpense:        { prefill?: Partial<import('@spendwise/shared').CreateExpenseInput> };
  ExpenseDetail:     { expenseId: string };
  ReceiptScanner:    undefined;
  AIAdvisor:         { initialMessage?: string };
  Goals:             undefined;
  GoalDetail:        { goalId: string };
  AddGoal:           undefined;
  Income:            undefined;
  AddIncome:         undefined;
  Debts:             undefined;
  Analytics:         undefined;
  Forecast:          undefined;
  WhatIfSimulator:   undefined;
  Achievements:      undefined;
  Notifications:     undefined;
  WeeklyReflection:  { exceededCategory?: string };
  ScoreDetail:       undefined;
  LiteracyHub:       undefined;
  LiteracyArticle:   { articleId: string };
  Settings:          undefined;
  Export:            undefined;
  BillCalendar:      undefined;
};

// ─── Navigation Props Helpers ─────────────────────────────────────────────────

export type RootNavProp     = NativeStackNavigationProp<RootStackParamList>;
export type AuthNavProp     = NativeStackNavigationProp<AuthStackParamList>;
export type AppTabNavProp   = BottomTabNavigationProp<AppTabParamList>;
export type AppStackNavProp = NativeStackNavigationProp<AppStackParamList>;

export type HomeTabNavProp = CompositeNavigationProp<
  BottomTabNavigationProp<AppTabParamList, 'Home'>,
  NativeStackNavigationProp<AppStackParamList>
>;

export type SplashScreenProps  = NativeStackScreenProps<AuthStackParamList, 'Splash'>;
export type LoginScreenProps   = NativeStackScreenProps<AuthStackParamList, 'Login'>;
export type SignUpScreenProps  = NativeStackScreenProps<AuthStackParamList, 'SignUp'>;
export type AddExpenseProps    = NativeStackScreenProps<AppStackParamList, 'AddExpense'>;
export type AIAdvisorProps     = NativeStackScreenProps<AppStackParamList, 'AIAdvisor'>;
export type GoalDetailProps    = NativeStackScreenProps<AppStackParamList, 'GoalDetail'>;
