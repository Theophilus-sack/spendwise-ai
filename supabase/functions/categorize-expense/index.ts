import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.27.0';
import { authenticate, AuthError } from '../_shared/auth.ts';
import { enforceRateLimit, RateLimitError } from '../_shared/rateLimit.ts';
import { optionalString } from '../_shared/validate.ts';
import { CORS_HEADERS, json } from '../_shared/http.ts';
import { CLAUDE_MODEL } from '../_shared/anthropic.ts';
import { findCategoryOverride, buildFewShotLines } from '../_shared/categoryHistory.ts';

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });

const CATEGORIES = ['food','transport','groceries','bills','shopping','entertainment','health','education','rent','savings','other'];

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  try {
    const { userId } = await authenticate(req);
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    await enforceRateLimit(supabase, userId, 'categorize-expense', 60, 3600);

    const body = await req.json();
    const description  = optionalString(body.description, 300, 'description');
    const merchantHint = optionalString(body.merchantHint, 200, 'merchantHint');
    const amount       = body.amount;
    const input = `${description ?? ''} ${merchantHint ?? ''}`.trim();

    if (!input) return json({ category: 'other', confidence: 0.4 });

    // Learn from this user's own history before asking the model anything —
    // an exact repeat merchant/description is the strongest possible signal,
    // since it's literally what they already decided last time.
    const { data: history } = await supabase
      .from('expenses')
      .select('merchant_name, description, category, date')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(200);

    const override = findCategoryOverride(merchantHint, description, history ?? []);
    if (override) return json(override);

    const fewShot = buildFewShotLines(history ?? []);
    const personalization = fewShot.length > 0
      ? `\n\nThis user's own past categorizations (follow their pattern for similar merchants):\n${fewShot.join('\n')}`
      : '';

    const message = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 60,
      messages: [{
        role: 'user',
        content: `Classify this expense into exactly one category.
Categories: ${CATEGORIES.join(', ')}

Rules:
- Respond ONLY with valid JSON: {"category": "...", "confidence": 0.00}
- Confidence is your certainty from 0.0 to 1.0
- Mobile money transfer for rent → rent, not bills
- Ghana context: Bolt/Yango/Uber → transport, Shoprite/Melcom → groceries, MTN/Vodafone → bills

Examples:
"KFC Accra Mall, ₵78" → {"category": "food", "confidence": 0.97}
"Bolt ride, ₵32" → {"category": "transport", "confidence": 0.99}
"DSTV, ₵120" → {"category": "bills", "confidence": 0.96}
"Silverbird Cinema, ₵80" → {"category": "entertainment", "confidence": 0.95}${personalization}

Input: "${input}", ₵${amount ?? '?'}`,
      }],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text.trim() : '{}';
    const match = text.match(/\{[^}]+\}/);
    const result = match ? JSON.parse(match[0]) : { category: 'other', confidence: 0.4 };

    // Validate category
    if (!CATEGORIES.includes(result.category)) result.category = 'other';
    result.confidence = Math.min(Math.max(Number(result.confidence) || 0.4, 0), 1);

    return json(result);
  } catch (err: any) {
    if (err instanceof AuthError) return json({ error: err.message }, 401);
    if (err instanceof RateLimitError) return json({ error: err.message }, 429);
    // Any other failure (Anthropic API error, malformed JSON, etc.) degrades to a safe default
    // rather than breaking expense creation — this endpoint is a convenience classifier, not
    // something the caller should have to handle special error shapes for. Status stays 200 on
    // purpose (the deliberate degrade), but `error` is still included so this is at least
    // distinguishable from a genuine "other" classification if anything ever wants to check.
    return json({ category: 'other', confidence: 0.4, error: err instanceof Error ? err.message : 'unknown' });
  }
});
