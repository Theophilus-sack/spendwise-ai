import * as Linking from 'expo-linking';
import type { LinkingOptions } from '@react-navigation/native';
import type { RootStackParamList } from './types';

export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [Linking.createURL('/'), 'spendwise://'],
  config: {
    screens: {
      App: {
        screens: {
          Tabs: {
            screens: {
              Home:     'home',
              Expenses: 'expenses',
              Budget:   'budget',
              Profile:  'profile',
            },
          },
          Debts:            'debts',
          BillCalendar:      'bills',
          LiteracyHub:       'learn',
          LiteracyArticle:   'learn/:articleId',
          ScoreDetail:       'score',
          Notifications:     'notifications',
          WeeklyReflection:  'reflection',
          Settings:          'settings',
          Analytics:         'analytics',
          Goals:             'goals',
          AIAdvisor:         'advisor',
        },
      },
      Auth: {
        screens: {
          Login:  'login',
          SignUp: 'signup',
        },
      },
    },
  },
};
