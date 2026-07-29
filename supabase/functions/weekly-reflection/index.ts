import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.27.0';
import { authenticate, AuthError } from '../_shared/auth.ts';
import { enforceRateLimit, RateLimitError } from '../_shared/rateLimit.ts';
import { requireString, optionalString, ValidationError } from '../_shared/validate.ts';
import { computeFDS, saveFDS } from '../_shared/fds.ts';

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const FOLLOW_THROUGH_VALUES = ['yes', 'partially', 'no'];

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders() });

  try {
    const { userId } = await authenticate(req); // always the caller's own reflection
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    await enforceRateLimit(supabase, userId, 'weekly-reflection', 10, 3600);

    const body = await req.json();
    const weekStart = requireString(body.weekStart, 10, 'weekStart');
    if (!DATE_RE.test(weekStart)) throw new ValidationError('weekStart must be an ISO date (YYYY-MM-DD).');

    const exceededCategory = optionalString(body.exceededCategory, 50, 'exceededCategory') ?? null;
    const smallChange = requireString(body.smallChange, 300, 'smallChange');
    const adjustNextWeek = Boolean(body.adjustNextWeek);
    const moodRating = Math.round(Number(body.moodRating));
    if (!Number.isFinite(moodRating) || moodRating < 1 || moodRating > 5) {
      throw new ValidationError('moodRating must be an integer from 1 to 5.');
    }
    const followThrough = body.followThrough != null ? String(body.followThrough) : null;
    if (followThrough !== null && !FOLLOW_THROUGH_VALUES.includes(followThrough)) {
      throw new ValidationError('followThrough must be one of yes, partially, no.');
    }

    const prevWeekStart = shiftDate(weekStart, -7);
    const [{ data: prevReflection }, { data: prevWeekScore }] = await Promise.all([
      supabase.from('weekly_reflections').select('small_change').eq('user_id', userId).eq('week_start', prevWeekStart).maybeSingle(),
      supabase.from('discipline_scores').select('score,budget_adherence,savings_rate,consistency').eq('user_id', userId).eq('week_start', prevWeekStart).maybeSingle(),
    ]);

    // Save the reflection first — computeFDS (below) checks for its existence
    // to award the reflection bonus, so this has to land before recomputing.
    const { error: upsertError } = await supabase.from('weekly_reflections').upsert({
      user_id: userId,
      week_start: weekStart,
      exceeded_category: exceededCategory,
      adjust_next_week: adjustNextWeek,
      small_change: smallChange,
      mood_rating: moodRating,
      follow_through: followThrough,
    }, { onConflict: 'user_id,week_start' });
    if (upsertError) throw upsertError;

    const computation = await computeFDS(supabase, userId, weekStart);
    await saveFDS(supabase, userId, weekStart, computation);

    const mover = biggestMover(computation.components, prevWeekScore);
    const aiResponse = await generateResponse({
      computation, mover, exceededCategory, adjustNextWeek, smallChange, moodRating,
      followThrough, previousPlan: prevReflection?.small_change ?? null,
    });

    await supabase.from('weekly_reflections')
      .update({ ai_response: aiResponse })
      .eq('user_id', userId)
      .eq('week_start', weekStart);

    return json({
      score: computation.score,
      grade: computation.grade,
      reflectionBonus: computation.reflectionBonus,
      aiResponse,
    });
  } catch (err: any) {
    if (err instanceof AuthError) return json({ error: err.message }, 401);
    if (err instanceof ValidationError) return json({ error: err.message }, 400);
    if (err instanceof RateLimitError) return json({ error: err.message }, 429);
    return json({ error: err.message }, 500);
  }
});

function biggestMover(
  current: { budgetAdherence: number; savingsRate: number; consistency: number },
  previous: { budget_adherence: number; savings_rate: number; consistency: number } | null,
): { name: string; delta: number } | null {
  if (!previous) return null;
  const diffs = [
    { name: 'budget adherence', delta: current.budgetAdherence - Number(previous.budget_adherence ?? 0) },
    { name: 'savings rate',     delta: current.savingsRate - Number(previous.savings_rate ?? 0) },
    { name: 'consistency',      delta: current.consistency - Number(previous.consistency ?? 0) },
  ];
  diffs.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  return Math.abs(diffs[0].delta) > 0.01 ? diffs[0] : null;
}

async function generateResponse(ctx: {
  computation: Awaited<ReturnType<typeof computeFDS>>;
  mover: { name: string; delta: number } | null;
  exceededCategory: string | null;
  adjustNextWeek: boolean;
  smallChange: string;
  moodRating: number;
  followThrough: string | null;
  previousPlan: string | null;
}): Promise<string> {
  const { computation, mover, exceededCategory, adjustNextWeek, smallChange, moodRating, followThrough, previousPlan } = ctx;

  const lines = [
    `Score this week: ${computation.score}/100 (Grade ${computation.grade}, ${computation.trend})`,
    mover ? `Biggest mover vs last week: ${mover.name} (${mover.delta > 0 ? '+' : ''}${Math.round(mover.delta * 100)} pts)` : 'No prior week to compare yet.',
    exceededCategory ? `Category that went over budget: ${exceededCategory}` : 'No category went over budget this week.',
    `Plans to adjust next week's budget: ${adjustNextWeek ? 'yes' : 'no'}`,
    `Their stated plan for next week: "${smallChange}"`,
    `Mood rating (1-5): ${moodRating}`,
    followThrough && previousPlan
      ? `Last week they planned: "${previousPlan}" — they say they followed through: ${followThrough}.`
      : '',
  ].filter(Boolean).join('\n');

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 100,
    messages: [{
      role: 'user',
      content: `You are a personal financial coach responding to a user's weekly reflection. Write 2-3 short, warm, specific sentences.
Rules:
- Reference their actual numbers/plan below — never generic advice.
- If they followed through on last week's plan, genuinely acknowledge it. If they only partially did or didn't, be encouraging, not judgmental.
- End with one concrete, specific nod to their stated plan for next week.

${lines}`,
    }],
  });

  return message.content[0].type === 'text' ? message.content[0].text.trim() : '';
}

function shiftDate(iso: string, deltaDays: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + deltaDays);
  return d.toISOString().split('T')[0];
}

const corsHeaders = () => ({
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
});
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...corsHeaders() } });
