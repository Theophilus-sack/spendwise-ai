import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { computeFDS, saveFDS, type FDSComputation } from '../_shared/fds.ts';
import { sendPush } from '../_shared/push.ts';
import { CORS_HEADERS, json } from '../_shared/http.ts';

// This function is only ever meant to be called by the weekly pg_cron job,
// never by a real user session — a shared secret (not a user JWT) gates it,
// so verify_jwt is off for this function in config.toml.
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  const cronSecret = req.headers.get('x-cron-secret');
  if (!cronSecret || cronSecret !== Deno.env.get('CRON_SECRET')) {
    return json({ error: 'Unauthorized' }, 401);
  }

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const weekStart = mostRecentCompletedWeekStart();

    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('onboarding_completed', true);

    let sent = 0;
    for (const p of profiles ?? []) {
      try {
        const computation = await computeFDS(supabase, p.user_id, weekStart);
        await saveFDS(supabase, p.user_id, weekStart, computation);
        await sendPush(supabase, p.user_id, {
          type: 'weekly_digest',
          title: `Your discipline score: ${computation.grade}`,
          body: digestBody(computation),
          data: { weekStart, score: computation.score, grade: computation.grade },
        });
        sent++;
      } catch {
        // One user's failure (missing profile data, etc.) shouldn't stop the batch.
      }
    }

    return json({ processed: profiles?.length ?? 0, sent });
  } catch (err: any) {
    return json({ error: err.message }, 500);
  }
});

function digestBody(c: FDSComputation): string {
  const trendText = c.trend === 'improving' ? "trending up from last week"
    : c.trend === 'declining' ? 'a bit softer than last week'
    : 'holding steady';
  return `${c.score}/100 last week — ${trendText}. Tap to see the full breakdown.`;
}

/** The Sunday-Saturday week before the one currently in progress — a digest
 *  summarizes a week that's actually finished, not one still underway. */
function mostRecentCompletedWeekStart(): string {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  now.setDate(now.getDate() - now.getDay() - 7);
  return now.toISOString().split('T')[0];
}
