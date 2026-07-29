import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.27.0';
import { authenticate, AuthError } from '../_shared/auth.ts';
import { enforceRateLimit, RateLimitError } from '../_shared/rateLimit.ts';
import { requireString, ValidationError } from '../_shared/validate.ts';
import { computeFDS, saveFDS } from '../_shared/fds.ts';

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });
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

    const computation = await computeFDS(supabase, userId, weekStart);
    const { score, grade, trend, components, uniqueDays, reflectionBonus } = computation;

    // AI commentary
    const commentaryRes = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 80,
      messages: [{
        role: 'user',
        content: `Write 2 short encouraging sentences about this weekly financial discipline score.
Score: ${score}/100 (Grade ${grade})
Budget adherence: ${(components.budgetAdherence * 100).toFixed(0)}%
Savings rate: ${(components.savingsRate * 100).toFixed(0)}% of target
Days logged: ${uniqueDays}/7
Trend: ${trend}
Be specific and motivating, not generic.`,
      }],
    });
    const commentary = commentaryRes.content[0].type === 'text' ? commentaryRes.content[0].text.trim() : '';

    await saveFDS(supabase, userId, weekStart, computation, commentary);

    return json({ score, grade, trend, commentary, components, reflectionBonus });
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
