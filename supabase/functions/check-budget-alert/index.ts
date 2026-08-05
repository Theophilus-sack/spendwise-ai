import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authenticate, AuthError } from '../_shared/auth.ts';
import { enforceRateLimit, RateLimitError } from '../_shared/rateLimit.ts';
import { requireString, ValidationError } from '../_shared/validate.ts';
import { sendPush } from '../_shared/push.ts';
import { CORS_HEADERS, json } from '../_shared/http.ts';

const NEAR_THRESHOLD = 0.9;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  try {
    const { userId } = await authenticate(req); // always the caller's own budgets
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    await enforceRateLimit(supabase, userId, 'check-budget-alert', 60, 3600);

    const body = await req.json();
    const category = requireString(body.category, 50, 'category');

    const { data: budget } = await supabase
      .from('budgets')
      .select('limit_amount')
      .eq('user_id', userId)
      .eq('category', category)
      .eq('period', 'monthly')
      .maybeSingle();
    if (!budget || Number(budget.limit_amount) <= 0) return json({ alerted: false, reason: 'no_budget' });

    const monthStart = new Date();
    monthStart.setDate(1);
    const monthStartStr = monthStart.toISOString().split('T')[0];

    const { data: expenses } = await supabase
      .from('expenses')
      .select('amount')
      .eq('user_id', userId)
      .eq('category', category)
      .gte('date', monthStartStr);

    const spent = (expenses ?? []).reduce((s: number, e: any) => s + parseFloat(e.amount), 0);
    const limit = Number(budget.limit_amount);
    const pct = spent / limit;

    const severity = pct >= 1 ? 'over' : pct >= NEAR_THRESHOLD ? 'near' : null;
    if (!severity) return json({ alerted: false, pct });

    // Only alert once per threshold crossing per category per month — otherwise
    // every subsequent expense in an already-over category would re-notify.
    const { data: existing } = await supabase
      .from('notification_log')
      .select('id')
      .eq('user_id', userId)
      .eq('type', 'budget_alert')
      .contains('data', { category, monthStart: monthStartStr, severity })
      .maybeSingle();
    if (existing) return json({ alerted: false, reason: 'already_notified' });

    const categoryLabel = category.charAt(0).toUpperCase() + category.slice(1);
    await sendPush(supabase, userId, {
      type: 'budget_alert',
      title: severity === 'over' ? `${categoryLabel} budget exceeded` : `${categoryLabel} budget almost reached`,
      body: severity === 'over'
        ? `You've spent ${spent.toFixed(2)} of your ${limit.toFixed(2)} ${category} budget this month.`
        : `You're at ${Math.round(pct * 100)}% of your ${category} budget this month.`,
      data: { category, monthStart: monthStartStr, severity, pct },
    });

    return json({ alerted: true, severity, pct });
  } catch (err: any) {
    if (err instanceof AuthError) return json({ error: err.message }, 401);
    if (err instanceof ValidationError) return json({ error: err.message }, 400);
    if (err instanceof RateLimitError) return json({ error: err.message }, 429);
    return json({ error: err.message }, 500);
  }
});
