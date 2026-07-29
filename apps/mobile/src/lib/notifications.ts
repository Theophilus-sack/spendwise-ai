import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from './supabase';
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
 * Requests permission and registers this device's Expo push token against
 * the signed-in user's profile. Safe to call every time the app becomes
 * authenticated — it's a cheap no-op once a token is already registered,
 * and picks up a fresh token if the OS ever issues a new one.
 *
 * Requires an EAS project id in app.json (`expo.extra.eas.projectId`), which
 * this repo doesn't have configured yet — run `eas init` to link one. Until
 * then this silently no-ops rather than crashing the app.
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
