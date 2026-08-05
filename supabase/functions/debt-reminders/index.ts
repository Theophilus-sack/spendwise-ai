import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendPush } from '../_shared/push.ts';
import { CORS_HEADERS, json } from '../_shared/http.ts';

const REMINDER_WINDOW_DAYS = 3;
const DEDUPE_WINDOW_DAYS   = 5;

// Cron-only, same trust model as weekly-digest — a shared secret, not a user JWT.
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  const cronSecret = req.headers.get('x-cron-secret');
  if (!cronSecret || cronSecret !== Deno.env.get('CRON_SECRET')) {
    return json({ error: 'Unauthorized' }, 401);
  }

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: debts } = await supabase
      .from('debts')
      .select('id, user_id, label, min_payment, due_day_of_month, current_balance, status')
      .eq('status', 'active')
      .not('due_day_of_month', 'is', null);

    const dedupeSince = new Date(today);
    dedupeSince.setDate(dedupeSince.getDate() - DEDUPE_WINDOW_DAYS);

    let sent = 0;
    for (const debt of debts ?? []) {
      const days = daysUntilDue(debt.due_day_of_month, today);
      if (days < 0 || days > REMINDER_WINDOW_DAYS) continue;

      const { data: existing } = await supabase
        .from('notification_log')
        .select('id')
        .eq('user_id', debt.user_id)
        .eq('type', 'debt_reminder')
        .contains('data', { debtId: debt.id })
        .gte('sent_at', dedupeSince.toISOString())
        .maybeSingle();
      if (existing) continue;

      const dueText = days === 0 ? 'due today' : days === 1 ? 'due tomorrow' : `due in ${days} days`;
      await sendPush(supabase, debt.user_id, {
        type: 'debt_reminder',
        title: `${debt.label} payment ${dueText}`,
        body: debt.min_payment
          ? `Minimum payment of ${debt.min_payment} is ${dueText}.`
          : `A payment on your ${debt.label} balance of ${debt.current_balance} is ${dueText}.`,
        data: { debtId: debt.id, daysUntilDue: days },
      });
      sent++;
    }

    return json({ checked: debts?.length ?? 0, sent });
  } catch (err: any) {
    return json({ error: err.message }, 500);
  }
});

/** Days from `today` until the next occurrence of `dueDayOfMonth`, clamping
 *  to the actual last day of a shorter month (e.g. due day 31 in a 30-day
 *  month lands on the 30th). */
function daysUntilDue(dueDayOfMonth: number, today: Date): number {
  const year = today.getFullYear();
  const month = today.getMonth();
  const todayDay = today.getDate();

  const daysInThisMonth = new Date(year, month + 1, 0).getDate();
  const dueThisMonth = Math.min(dueDayOfMonth, daysInThisMonth);
  if (dueThisMonth >= todayDay) return dueThisMonth - todayDay;

  const daysInNextMonth = new Date(year, month + 2, 0).getDate();
  const dueNextMonth = Math.min(dueDayOfMonth, daysInNextMonth);
  return (daysInThisMonth - todayDay) + dueNextMonth;
}
