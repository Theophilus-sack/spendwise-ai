-- Schedules the weekly discipline-score digest and daily debt-payment
-- reminders via pg_cron + pg_net.
--
-- MANUAL ONE-TIME SETUP REQUIRED — do this before these jobs will succeed:
-- The cron jobs authenticate to their edge functions with a shared secret
-- read from Supabase Vault at call time, never a value embedded in this
-- migration file. Run once, with the same random value in both places:
--
--   select vault.create_secret('<a-long-random-value>', 'cron_secret');
--   supabase secrets set CRON_SECRET=<the-same-long-random-value>
--
-- Until both are done, the jobs will fire on schedule but the functions will
-- reject the calls with 401 — a safe failure, not an open endpoint.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- Weekly discipline score digest — Monday 08:00 UTC.
select cron.schedule(
  'weekly-digest-job',
  '0 8 * * 1',
  $$
  select net.http_post(
    url := 'https://qxnzeydoleecdbklvega.supabase.co/functions/v1/weekly-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Debt/bill due-date reminders — daily at 09:00 UTC.
select cron.schedule(
  'debt-reminders-job',
  '0 9 * * *',
  $$
  select net.http_post(
    url := 'https://qxnzeydoleecdbklvega.supabase.co/functions/v1/debt-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
