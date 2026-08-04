import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import { navigateIntoApp, navigateToTab } from '@/navigation/navigationRef';
import appConfig from '../../app.json';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Routes a tapped push notification to the screen it's actually about,
 * based on the `type`/`data` payload set by the edge function that sent it
 * (see supabase/functions/_shared/push.ts callers). Falls back to the
 * in-app notification inbox for any type this doesn't recognize yet.
 */
function routeNotificationTap(data: Record<string, any>): void {
  switch (data?.type) {
    case 'budget_alert':
      navigateToTab('Budget');
      return;
    case 'debt_reminder':
      navigateIntoApp('BillCalendar');
      return;
    case 'weekly_digest':
      navigateIntoApp('ScoreDetail');
      return;
    case 'anomaly':
      navigateIntoApp('AIAdvisor', {
        initialMessage: `Can you explain why this ${data.category ?? ''} expense looked unusual?`,
      });
      return;
    default:
      navigateIntoApp('Notifications');
  }
}

/**
 * Wires up notification-tap routing: handles the case where the app is
 * already running (listener) and the case where a notification tap is what
 * launched the app from a killed state (checked once on startup). Call once
 * near the app root; returns an unsubscribe function.
 */
export function setupNotificationResponseHandling(): () => void {
  Notifications.getLastNotificationResponseAsync().then((response) => {
    if (response) routeNotificationTap(response.notification.request.content.data as any);
  });

  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    routeNotificationTap(response.notification.request.content.data as any);
  });

  return () => subscription.remove();
}

/**
 * Requests permission and registers this device's Expo push token against
 * the signed-in user's profile. Safe to call every time the app becomes
 * authenticated — it's a cheap no-op once a token is already registered,
 * and picks up a fresh token if the OS ever issues a new one.
 *
 * Requires an EAS project id in app.json (`expo.extra.eas.projectId`) — set
 * via `eas init`.
 */
export async function registerForPushNotifications(userId: string): Promise<void> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return;

    const projectId = (appConfig as any)?.expo?.extra?.eas?.projectId;
    if (!projectId) {
      console.warn('[notifications] No EAS project id configured (expo.extra.eas.projectId in app.json) — skipping push token registration. Run `eas init` to set one up.');
      return;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#1A6B4A',
      });
    }

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await supabase.from('profiles').update({ push_token: token }).eq('user_id', userId);
  } catch (err) {
    // Push registration is a best-effort enhancement, never something that
    // should block the app from working (e.g. it always fails on a simulator).
    console.warn('[notifications] Push registration failed:', err);
  }
}
