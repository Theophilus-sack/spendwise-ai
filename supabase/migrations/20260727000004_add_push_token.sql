-- One push token per user is enough for this app's scale — if they reinstall
-- or switch devices, the token is simply overwritten on next registration.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS push_token TEXT;

-- notification_log is read per-user from the client (the Notifications inbox)
-- and written only by edge functions via the service-role client — the index
-- matches that exact read pattern.
CREATE INDEX IF NOT EXISTS idx_notification_log_user
  ON public.notification_log(user_id, sent_at DESC);
