import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.27.0';
import { authenticate, AuthError } from '../_shared/auth.ts';
import { enforceRateLimit, RateLimitError } from '../_shared/rateLimit.ts';
import { requireString, ValidationError } from '../_shared/validate.ts';
import { CORS_HEADERS, json } from '../_shared/http.ts';
import { CLAUDE_MODEL } from '../_shared/anthropic.ts';
import { findCategoryOverride, buildFewShotLines } from '../_shared/categoryHistory.ts';

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const EXPENSE_ITEM_SCHEMA = {
  type: 'object',
  properties: {
    amount: { type: ['number', 'null'] },
    description: { type: ['string', 'null'] },
    merchant_name: { type: ['string', 'null'] },
    category: {
      type: ['string', 'null'],
      enum: ['food', 'transport', 'groceries', 'bills', 'shopping', 'entertainment', 'health', 'education', 'rent', 'other', null],
    },
    date: { type: ['string', 'null'] },
    payment_method: { type: ['string', 'null'], enum: ['mobile_money', 'card', 'cash', null] },
    confidence: { type: 'number' },
  },
  required: ['amount', 'description', 'merchant_name', 'category', 'date', 'payment_method', 'confidence'],
};

const EXTRACT_EXPENSES_TOOL = {
  name: 'extract_expenses',
  description: 'Extract every distinct expense mentioned in the input text.',
  input_schema: {
    type: 'object',
    properties: {
      expenses: { type: 'array', items: EXPENSE_ITEM_SCHEMA },
    },
    required: ['expenses'],
  },
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  try {
    const { userId } = await authenticate(req);
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    await enforceRateLimit(supabase, userId, 'parse-nlp-expense', 30, 3600);

    const body = await req.json();
    const input = requireString(body.input, 2000, 'input');
    const today = requireString(body.today, 10, 'today');
    if (!DATE_RE.test(today)) throw new ValidationError('today must be an ISO date (YYYY-MM-DD).');

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    // Learn from this user's own history — an exact repeat merchant should
    // never need re-categorizing, and near-matches should lean the same way.
    const { data: history } = await supabase
      .from('expenses')
      .select('merchant_name, description, category, date')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(200);

    const fewShot = buildFewShotLines(history ?? []);
    const personalization = fewShot.length > 0
      ? `\n\nThis user's own past categorizations (follow their pattern for similar merchants):\n${fewShot.join('\n')}`
      : '';

    const message = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1200,
      tools: [EXTRACT_EXPENSES_TOOL],
      tool_choice: { type: 'tool', name: 'extract_expenses' },
      messages: [{
        role: 'user',
        content: `Extract every distinct expense mentioned in this natural language input — it may describe one expense or several (separated by commas, "and", newlines, etc). Use null for any field you cannot determine on a given expense.

Today's date: ${today}
Yesterday: ${yesterdayStr}
User's currency: GHS

Ghana context for category: Bolt/Yango/Uber/trotro → transport, Shoprite/Melcom/market → groceries, MTN/Vodafone/DSTV/electricity → bills, mobile money transfer for rent → rent (not bills).

Input: "${input}"

Examples:
"spent 80 cedis on bolt this morning" → one expense: {"amount": 80, "merchant_name": "Bolt", "category": "transport", "date": "${today}", "payment_method": null, "confidence": 0.95}
"bought lunch at papaye yesterday, 65 ghana" → one expense: {"amount": 65, "merchant_name": "Papaye", "category": "food", "date": "${yesterdayStr}", "confidence": 0.92}
"coffee 20 cedis, lunch at papaye 45, uber 15 momo" → three expenses: coffee (amount 20, category food), lunch at Papaye (amount 45, category food), uber (amount 15, category transport, payment_method mobile_money)${personalization}`,
      }],
    });

    const toolUse = message.content.find((c): c is Anthropic.ToolUseBlock => c.type === 'tool_use');
    const rawExpenses = ((toolUse?.input as { expenses?: Array<Record<string, unknown>> } | undefined)?.expenses ?? []);

    // An exact match on this user's own history beats whatever Claude guessed —
    // it's not a guess, it's what they already decided for this merchant.
    const expenses = rawExpenses.map((e) => {
      const override = findCategoryOverride(
        e.merchant_name as string | undefined,
        e.description as string | undefined,
        history ?? [],
      );
      return override ? { ...e, category: override.category, confidence: override.confidence } : e;
    });

    return json({ expenses });
  } catch (err: any) {
    if (err instanceof AuthError) return json({ error: err.message }, 401);
    if (err instanceof ValidationError) return json({ error: err.message }, 400);
    if (err instanceof RateLimitError) return json({ error: err.message }, 429);
    return json({ error: err.message }, 500);
  }
});
