export interface PushPayload {
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

/**
 * Sends a push notification if the user has a registered device token, and
 * always writes to notification_log regardless — so the in-app inbox has a
 * real record even when push delivery is skipped (no token yet) or fails
 * (e.g. a stale token after a reinstall).
 */
export async function sendPush(supabase: any, userId: string, payload: PushPayload): Promise<void> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('push_token')
    .eq('user_id', userId)
    .single();

  if (profile?.push_token) {
    try {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          to: profile.push_token,
          title: payload.title,
          body: payload.body,
          data: payload.data ?? {},
        }),
      });
    } catch {
      // Delivery failing shouldn't block the notification from being logged.
    }
  }

  await supabase.from('notification_log').insert({
    user_id: userId,
    type: payload.type,
    title: payload.title,
    body: payload.body,
    data: payload.data ?? null,
  });
}
