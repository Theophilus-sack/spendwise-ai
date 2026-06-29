import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { DashboardScreen }  from '@/screens/main/DashboardScreen';
import { ExpensesScreen }   from '@/screens/main/ExpensesScreen';
import { BudgetScreen }     from '@/screens/main/BudgetScreen';
import { ProfileScreen }    from '@/screens/main/ProfileScreen';
import { Colors, Radius, Shadows, Spacing } from '@/theme';
import type { AppTabParamList, AppStackNavProp } from './types';

const Tab = createBottomTabNavigator<AppTabParamList>();

function FABButton() {
  const nav = useNavigation<AppStackNavProp>();
  return (
    <TouchableOpacity
      style={styles.fab}
      onPress={() => nav.navigate('AddExpense', {})}
      activeOpacity={0.85}
    >
      <Ionicons name="add" size={28} color="#fff" />
    </TouchableOpacity>
  );
}

export function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textTertiary,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
        tabBarIcon: ({ color, focused }) => {
          const icons: Record<string, [string, string]> = {
            Home:     ['home',          'home-outline'],
            Expenses: ['receipt',       'receipt-outline'],
            Budget:   ['pie-chart',     'pie-chart-outline'],
            Profile:  ['person-circle', 'person-circle-outline'],
          };
          const [active, inactive] = icons[route.name] ?? ['ellipse', 'ellipse-outline'];
          return <Ionicons name={(focused ? active : inactive) as any} size={22} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home"     component={DashboardScreen} options={{ title: 'Home' }} />
      <Tab.Screen name="Expenses" component={ExpensesScreen} />
      <Tab.Screen
        name="Add"
        component={View as any}
        options={{
          tabBarButton: () => <FABButton />,
        }}
      />
      <Tab.Screen name="Budget" component={BudgetScreen} />
      <Tab.Screen name="Profile"  component={ProfileScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    height: 64,
    paddingBottom: 8,
    paddingTop: 6,
    ...Shadows.sm,
  },
  tabLabel: { fontSize: 10, fontWeight: '500' },
  fab: {
    width: 56, height: 56,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
    ...Shadows.primary,
  },
});
