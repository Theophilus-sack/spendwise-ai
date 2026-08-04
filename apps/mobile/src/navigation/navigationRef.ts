import { createNavigationContainerRef, CommonActions } from '@react-navigation/native';
import type { RootStackParamList, AppStackParamList, AppTabParamList } from './types';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

const MAX_READY_RETRIES = 10;

function whenReady(fn: () => void, attempt = 0): void {
  if (navigationRef.isReady()) {
    fn();
    return;
  }
  // Cold start: a notification tap can launch the app before the
  // NavigationContainer has mounted. Retry briefly rather than dropping it.
  if (attempt >= MAX_READY_RETRIES) return;
  setTimeout(() => whenReady(fn, attempt + 1), 300);
}

/** Navigates to a screen inside the authenticated app stack (AppNavigator). */
export function navigateIntoApp<Screen extends keyof AppStackParamList>(
  screen: Screen,
  params?: AppStackParamList[Screen],
): void {
  whenReady(() => {
    navigationRef.dispatch(
      CommonActions.navigate({ name: 'App', params: { screen, params } as never }),
    );
  });
}

/** Navigates to one of the bottom tabs inside the authenticated app. */
export function navigateToTab(tab: keyof AppTabParamList): void {
  whenReady(() => {
    navigationRef.dispatch(
      CommonActions.navigate({
        name: 'App',
        params: { screen: 'Tabs', params: { screen: tab } } as never,
      }),
    );
  });
}
