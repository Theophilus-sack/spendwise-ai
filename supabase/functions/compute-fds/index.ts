import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.27.0';
import { authenticate, AuthError } from '../_shared/auth.ts';
import { enforceRateLimit, RateLimitError } from '../_shared/rateLimit.ts';
import { requireString, ValidationError } from '../_shared/validate.ts';

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });

const FDS_WEIGHTS = { budgetAdherence: 0.35, savingsRate: 0.30, consistency: 0.20, improvement: 0.15 };
const clamp = (n: number, min = 0, max = 1) => Math.min(Math.max(n, min), max);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders() });

  try {
    const auth = await authenticate(req);
    const body = await req.json();
    const weekStart = requireString(body.weekStart, 10, 'weekStart');
    if (!DATE_RE.test(weekStart)) throw new ValidationError('weekStart must be an ISO date (YYYY-MM-DD).');

    // A real user can only ever compute their own score. Only the trusted
    // weekly batch job (authenticated with the service-role key) may compute
    // on behalf of an arbitrary userId, since it iterates over every user.
    const userId: string = auth.isService ? requireString(body.userId, 100, 'userId') : auth.userId;

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    if (!auth.isService) await enforceRateLimit(supabase, userId, 'compute-fds', 10, 3600);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const weekEndStr = weekEnd.toISOString().split('T')[0];

    const [{ data: expenses }, { data: budgets }, { data: profile }, { data: prevScore }] =
      await Promise.all([
        supabase.from('expenses').select('amount,category,date').eq('user_id', userId).gte('date', weekStart).lt('date', weekEndStr),
        supabase.from('budgets').select('category,limit_amount').eq('user_id', userId),
        supabase.from('profiles').select('monthly_income,savings_target_pct').eq('user_id', userId).single(),
        supabase.from('discipline_scores').select('score').eq('user_id', userId).lt('week_start', weekStart).order('week_start', { ascending: false }).limit(1).single(),
      ]);

    const expList   = expenses ?? [];
    const budgetList= budgets ?? [];

    // Component 1: Budget Adherence
    const spendByCategory = expList.reduce((acc: any, e: any) => {
      acc[e.category] = (acc[e.category] || 0) + parseFloat(e.amount);
      return acc;
    }, {});
    const categoriesOver = budgetList.filter((b: any) => (spendByCategory[b.category] ?? 0) > parseFloat(b.limit_amount) * (7/30));
    const budgetAdherence = clamp(budgetList.length > 0 ? 1 - (categoriesOver.length / budgetList.length) : 1);

    // Component 2: Savings Rate
    // `profile` is already the unwrapped row (destructured from `{ data: profile }` above) —
    // reading `profile.data.*` here previously always resolved to undefined, silently
    // zeroing weeklyIncome and therefore this entire component for every user.
    const weeklyIncome     = (parseFloat(profile?.monthly_income ?? 0) / 4.33);
    const targetSavingsPct = (parseFloat(profile?.savings_target_pct ?? 20)) / 100;
    const targetSavings    = weeklyIncome * targetSavingsPct;
    const actualSpent      = expList.reduce((s: number, e: any) => s + parseFloat(e.amount), 0);
    const actualSavings    = Math.max(0, weeklyIncome - actualSpent);
    const savingsRate      = clamp(targetSavings > 0 ? actualSavings / targetSavings : actualSavings > 0 ? 0.5 : 0);

    // Component 3: Consistency (days logged out of 7)
    const uniqueDays = new Set(expList.map((e: any) => e.date)).size;
    const consistency = clamp(uniqueDays / 7);

    // Component 4: Improvement trend (sigmoid — always bounded in (0,1) by construction)
    const rawScore = (budgetAdherence * FDS_WEIGHTS.budgetAdherence + savingsRate * FDS_WEIGHTS.savingsRate + consistency * FDS_WEIGHTS.consistency + 0.5 * FDS_WEIGHTS.improvement) * 100;
    const delta    = prevScore?.score != null ? rawScore - parseFloat(prevScore.score) : 0;
    const improvement = 1 / (1 + Math.exp(-delta / 10));

    const weighted = (budgetAdherence * FDS_WEIGHTS.budgetAdherence + savingsRate * FDS_WEIGHTS.savingsRate + consistency * FDS_WEIGHTS.consistency + improvement * FDS_WEIGHTS.improvement) * 100;
    const smoothed = prevScore?.score != null ? 0.7 * weighted + 0.3 * parseFloat(prevScore.score) : weighted;
    const score    = clamp(Math.round(smoothed * 10) / 10, 0, 100);
    const grade    = score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 55 ? 'C' : score >= 40 ? 'D' : 'F';

    // AI commentary
    const commentaryRes = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 80,
      messages: [{
        role: 'user',
        content: `Write 2 short encouraging sentences about this weekly financial discipline score.
Score: ${score}/100 (Grade ${grade})
Budget adherence: ${(budgetAdherence * 100).toFixed(0)}%
Savings rate: ${(savingsRate * 100).toFixed(0)}% of target
Days logged: ${uniqueDays}/7
Trend: ${delta > 2 ? 'improving' : delta < -2 ? 'declining' : 'stable'}
Be specific and motivating, not generic.`,
      }],
    });
    const commentary = commentaryRes.content[0].type === 'text' ? commentaryRes.content[0].text.trim() : '';

    // Save to database
    await supabase.from('discipline_scores').upsert({
      user_id:          userId,
      week_start:       weekStart,
      score,
      budget_adherence: budgetAdherence,
      savings_rate:     savingsRate,
      consistency,
      improvement_trend: improvement,
      ai_commentary:    commentary,
    });

    return json({ score, grade, commentary, components: { budgetAdherence, savingsRate, consistency, improvement } });
  } catch (err: any) {
    if (err instanceof AuthError) return json({ error: err.message }, 401);
    if (err instanceof ValidationError) return json({ error: err.message }, 400);
    if (err instanceof RateLimitError) return json({ error: err.message }, 429);
    return json({ error: err.message }, 500);
  }
});

const corsHeaders = () => ({
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
});
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...corsHeaders() } });
