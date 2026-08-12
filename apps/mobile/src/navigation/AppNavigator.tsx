import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TabNavigator }       from './TabNavigator';
import { AddExpenseScreen }   from '@/screens/main/AddExpenseScreen';
import { BatchReviewScreen }  from '@/screens/main/BatchReviewScreen';
import { VoiceExpenseScreen } from '@/screens/main/VoiceExpenseScreen';
import { StatementImportScreen } from '@/screens/main/StatementImportScreen';
import { AIAdvisorScreen }    from '@/screens/ai/AIAdvisorScreen';
import { GoalsScreen }        from '@/screens/main/GoalsScreen';
import { IncomeScreen }       from '@/screens/main/IncomeScreen';
import { DebtsScreen }        from '@/screens/main/DebtsScreen';
import { SettingsScreen }     from '@/screens/main/SettingsScreen';
import { NotificationsScreen } from '@/screens/main/NotificationsScreen';
import { ExportScreen } from '@/screens/main/ExportScreen';
import { WeeklyReflectionScreen } from '@/screens/main/WeeklyReflectionScreen';
import { AnalyticsScreen }    from '@/screens/main/AnalyticsScreen';
import { ForecastScreen }     from '@/screens/main/ForecastScreen';
import { AchievementsScreen } from '@/screens/main/AchievementsScreen';
import { ScoreDetailScreen }  from '@/screens/main/ScoreDetailScreen';
import { WhatIfScreen }       from '@/screens/main/WhatIfScreen';
import { ReceiptScannerScreen } from '@/screens/main/ReceiptScannerScreen';
import { BillCalendarScreen } from '@/screens/main/BillCalendarScreen';
import { LiteracyHubScreen } from '@/screens/main/LiteracyHubScreen';
import { LiteracyArticleScreen } from '@/screens/main/LiteracyArticleScreen';
import { Colors } from '@/theme';
import type { AppStackParamList } from './types';

const Stack = createNativeStackNavigator<AppStackParamList>();

export function AppNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: Colors.surface },
        headerTintColor: Colors.text,
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '600', fontSize: 17 },
      }}
    >
      <Stack.Screen name="Tabs"            component={TabNavigator}          options={{ headerShown: false }} />
      <Stack.Screen name="AddExpense"      component={AddExpenseScreen}      options={{ title: 'Add Expense', presentation: 'modal' }} />
      <Stack.Screen name="BatchReview"     component={BatchReviewScreen}     options={{ title: 'Review Expenses', presentation: 'modal' }} />
      <Stack.Screen name="VoiceExpense"    component={VoiceExpenseScreen}    options={{ title: 'Voice Add', presentation: 'modal' }} />
      <Stack.Screen name="StatementImport" component={StatementImportScreen} options={{ title: 'Import Statement', presentation: 'modal' }} />
      <Stack.Screen name="ReceiptScanner"  component={ReceiptScannerScreen}  options={{ title: 'Scan Receipt', presentation: 'modal' }} />
      <Stack.Screen name="AIAdvisor"       component={AIAdvisorScreen}       options={{ title: 'AI Advisor' }} />
      <Stack.Screen name="Goals"           component={GoalsScreen}           options={{ title: 'Savings Goals' }} />
      <Stack.Screen name="Income"          component={IncomeScreen}          options={{ title: 'Income' }} />
      <Stack.Screen name="Debts"           component={DebtsScreen}           options={{ title: 'Debts & Loans' }} />
      <Stack.Screen name="Analytics"       component={AnalyticsScreen}       options={{ title: 'Analytics' }} />
      <Stack.Screen name="Forecast"        component={ForecastScreen}        options={{ title: 'Spending Forecast' }} />
      <Stack.Screen name="Achievements"    component={AchievementsScreen}    options={{ title: 'Achievements' }} />
      <Stack.Screen name="ScoreDetail"     component={ScoreDetailScreen}     options={{ title: 'Discipline Score' }} />
      <Stack.Screen name="WhatIfSimulator" component={WhatIfScreen}          options={{ title: 'What-If Simulator' }} />
      <Stack.Screen name="Settings"        component={SettingsScreen}       options={{ title: 'Settings' }} />
      <Stack.Screen name="Notifications"   component={NotificationsScreen}  options={{ title: 'Notifications' }} />
      <Stack.Screen name="Export"          component={ExportScreen}         options={{ title: 'Export Reports' }} />
      <Stack.Screen name="WeeklyReflection" component={WeeklyReflectionScreen} options={{ title: 'Weekly Reflection', presentation: 'modal' }} />
      <Stack.Screen name="BillCalendar"    component={BillCalendarScreen}    options={{ headerShown: false }} />
      <Stack.Screen name="LiteracyHub"     component={LiteracyHubScreen}     options={{ headerShown: false }} />
      <Stack.Screen name="LiteracyArticle" component={LiteracyArticleScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}
