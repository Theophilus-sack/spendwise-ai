import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.27.0';
import { authenticate, AuthError } from '../_shared/auth.ts';
import { enforceRateLimit, RateLimitError } from '../_shared/rateLimit.ts';
import { requireString, ValidationError } from '../_shared/validate.ts';

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });
const ANOMALY_THRESHOLD     = 3.5;
const MIN_HISTORY           = 8;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders() });

  try {
    const { userId: callerId, isService } = await authenticate(req);
    const body = await req.json();
    const expenseId = requireString(body.expenseId, 100, 'expenseId');
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    if (!isService) await enforceRateLimit(supabase, callerId, 'detect-anomaly', 60, 3600);

    // Fetch the expense
    const { data: expense } = await supabase.from('expenses').select('*').eq('id', expenseId).single();
    if (!expense) return json({ isAnomaly: false });

    // A caller may only run anomaly detection on their own expense.
    if (!isService && expense.user_id !== callerId) {
      throw new AuthError('Unauthorized — this expense does not belong to you.');
    }

    // Get 90-day history for this category (excluding this expense)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const { data: history } = await supabase
      .from('expenses')
      .select('amount')
      .eq('user_id', expense.user_id)
      .eq('category', expense.category)
      .neq('id', expenseId)
      .gte('date', ninetyDaysAgo.toISOString().split('T')[0]);

    const amounts = (history ?? []).map((e: any) => parseFloat(e.amount));

    if (amounts.length < MIN_HISTORY) return json({ isAnomaly: false, reason: 'insufficient_history' });

    // Modified Z-score (Iglewicz-Hoaglin)
    const sorted = [...amounts].sort((a, b) => a - b);
    const median = computeMedian(sorted);
    const deviations = amounts.map(x => Math.abs(x - median));
    const mad = computeMedian([...deviations].sort((a, b) => a - b));

    if (mad === 0) return json({ isAnomaly: false });

    const modifiedZScore = (0.6745 * (parseFloat(expense.amount) - median)) / mad;
    const isAnomaly = Math.abs(modifiedZScore) > ANOMALY_THRESHOLD;

    if (!isAnomaly) return json({ isAnomaly: false, modifiedZScore });

    // Generate plain-language explanation
    const explanation = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 60,
      messages: [{
        role: 'user',
        content: `Write ONE short friendly sentence (max 15 words) noting this expense seems unusually high.
Category: ${expense.category}, Amount: ${expense.currency} ${expense.amount}, Typical range: ${expense.currency} ${(median * 0.5).toFixed(0)}–${(median * 1.5).toFixed(0)}`,
      }],
    });
    const message = explanation.content[0].type === 'text' ? explanation.content[0].text.trim() : '';

    // Log anomaly to database
    await supabase.from('anomaly_events').insert({
      user_id:            expense.user_id,
      expense_id:         expenseId,
      category:           expense.category,
      transaction_amount: expense.amount,
      category_median:    median,
      category_mad:       mad,
      modified_z_score:   modifiedZScore,
    });

    return json({ isAnomaly: true, modifiedZScore, median, mad, message });
  } catch (err: any) {
    if (err instanceof AuthError) return json({ error: err.message, isAnomaly: false }, 401);
    if (err instanceof ValidationError) return json({ error: err.message, isAnomaly: false }, 400);
    if (err instanceof RateLimitError) return json({ error: err.message, isAnomaly: false }, 429);
    return json({ error: err.message, isAnomaly: false }, 500);
  }
});

function computeMedian(sorted: number[]): number {
  const n = sorted.length;
  if (n === 0) return 0;
  const mid = Math.floor(n / 2);
  return n % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const corsHeaders = () => ({
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
});
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...corsHeaders() } });
