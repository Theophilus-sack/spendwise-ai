import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TabNavigator }       from './TabNavigator';
import { AddExpenseScreen }   from '@/screens/main/AddExpenseScreen';
import { AIAdvisorScreen }    from '@/screens/ai/AIAdvisorScreen';
import { GoalsScreen }        from '@/screens/main/GoalsScreen';
import { IncomeScreen }       from '@/screens/main/IncomeScreen';
import { DebtsScreen }        from '@/screens/main/DebtsScreen';
import { AnalyticsScreen }    from '@/screens/main/AnalyticsScreen';
import { ForecastScreen }     from '@/screens/main/ForecastScreen';
import { AchievementsScreen } from '@/screens/main/AchievementsScreen';
import { ScoreDetailScreen }  from '@/screens/main/ScoreDetailScreen';
import { WhatIfScreen }       from '@/screens/main/WhatIfScreen';
import { ReceiptScannerScreen } from '@/screens/main/ReceiptScannerScreen';
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
    </Stack.Navigator>
  );
}
