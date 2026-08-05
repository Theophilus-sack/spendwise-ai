import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.27.0';
import { authenticate, AuthError } from '../_shared/auth.ts';
import { enforceRateLimit, RateLimitError } from '../_shared/rateLimit.ts';
import { requireString, optionalString, ValidationError } from '../_shared/validate.ts';
import { CORS_HEADERS, json } from '../_shared/http.ts';
import { CLAUDE_MODEL } from '../_shared/anthropic.ts';

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  try {
    const { userId } = await authenticate(req); // always a live user for this endpoint

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    await enforceRateLimit(supabase, userId, 'ai-advisor', 20, 3600); // 20 messages/hour

    const body = await req.json();
    const message = requireString(body.message, 2000, 'message');
    const conversationId = optionalString(body.conversationId, 100, 'conversationId');

    // ── Build financial context ──────────────────────────────────────────────
    const ctx = await buildFinancialContext(supabase, userId);

    // ── Load or create conversation ──────────────────────────────────────────
    let conversation: { id: string; messages: any[] } | null = null;

    if (conversationId) {
      const { data } = await supabase
        .from('ai_conversations')
        .select('id, messages')
        .eq('id', conversationId)
        .eq('user_id', userId)
        .single();
      conversation = data;
    }

    const history: Anthropic.MessageParam[] = (conversation?.messages ?? []).slice(-16); // last 8 turns

    // ── Call Claude ──────────────────────────────────────────────────────────
    const response = await anthropic.messages.create({
      model:      CLAUDE_MODEL,
      max_tokens: 600,
      system:     buildSystemPrompt(ctx),
      messages:   [...history, { role: 'user', content: message }],
    });

    const reply = response.content[0].type === 'text' ? response.content[0].text : '';

    // ── Parse optional action block ──────────────────────────────────────────
    const actions = extractActions(reply);
    const cleanReply = reply.replace(/\{\"action\"[^}]+\}/g, '').trim();

    // ── Persist conversation ─────────────────────────────────────────────────
    const updatedMessages = [
      ...history,
      { role: 'user',      content: message,    timestamp: new Date().toISOString() },
      { role: 'assistant', content: cleanReply, timestamp: new Date().toISOString() },
    ];

    let newConversationId = conversationId;
    if (conversationId) {
      await supabase
        .from('ai_conversations')
        .update({ messages: updatedMessages, updated_at: new Date().toISOString() })
        .eq('id', conversationId);
    } else {
      const { data } = await supabase
        .from('ai_conversations')
        .insert({ user_id: userId, messages: updatedMessages, context_snapshot: ctx })
        .select('id')
        .single();
      newConversationId = data?.id;
    }

    return json({ reply: cleanReply, conversationId: newConversationId, actions });
  } catch (err: any) {
    if (err instanceof AuthError) return json({ error: err.message }, 401);
    if (err instanceof ValidationError) return json({ error: err.message }, 400);
    if (err instanceof RateLimitError) return json({ error: err.message }, 429);
    return json({ error: err.message }, 500);
  }
});

// ─── Context Builder ──────────────────────────────────────────────────────────

async function buildFinancialContext(supabase: any, userId: string) {
  const now       = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const lastMonth  = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lmStart    = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}-01`;
  const lmEnd      = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

  const [{ data: profile }, { data: expenses }, { data: budgets }, { data: goals }, { data: fds }] =
    await Promise.all([
      supabase.from('profiles').select('full_name,currency,monthly_income,savings_target_pct,spending_personality').eq('user_id', userId).single(),
      supabase.from('expenses').select('amount,category,date,merchant_name').eq('user_id', userId).gte('date', lmStart).order('date', { ascending: false }),
      supabase.from('budgets').select('category,limit_amount,period').eq('user_id', userId),
      supabase.from('goals').select('title,target_amount,current_amount,deadline,status').eq('user_id', userId).eq('status', 'active'),
      supabase.from('discipline_scores').select('score,ai_commentary').eq('user_id', userId).order('week_start', { ascending: false }).limit(1).single(),
    ]);

  const thisMonthExp = (expenses ?? []).filter((e: any) => e.date >= monthStart);
  const lastMonthExp = (expenses ?? []).filter((e: any) => e.date >= lmStart && e.date < lmEnd);

  const sumBy = (arr: any[], key: string) => arr.reduce((s: number, e: any) => s + parseFloat(e[key] || 0), 0);
  const groupSum = (arr: any[]) => arr.reduce((acc: any, e: any) => {
    acc[e.category] = (acc[e.category] || 0) + parseFloat(e.amount || 0);
    return acc;
  }, {});

  return {
    name: profile?.full_name ?? 'the user',
    currency: profile?.currency ?? 'GHS',
    monthlyIncome: profile?.monthly_income ?? 0,
    savingsTargetPct: profile?.savings_target_pct ?? 20,
    personality: profile?.spending_personality ?? 'balanced',
    thisMonth: {
      total: sumBy(thisMonthExp, 'amount'),
      count: thisMonthExp.length,
      byCategory: groupSum(thisMonthExp),
    },
    lastMonth: { total: sumBy(lastMonthExp, 'amount') },
    budgets: (budgets ?? []).map((b: any) => ({
      category: b.category,
      limit: b.limit_amount,
      spent: groupSum(thisMonthExp)[b.category] ?? 0,
    })),
    goals: (goals ?? []).map((g: any) => ({
      title: g.title,
      target: g.target_amount,
      saved: g.current_amount,
      pct: g.target_amount > 0 ? ((g.current_amount / g.target_amount) * 100).toFixed(1) : 0,
      deadline: g.deadline,
    })),
    fds: fds ? { score: fds.score } : null,
  };
}

function buildSystemPrompt(ctx: any): string {
  return `You are SpendWise AI, a personal financial advisor for ${ctx.name} in Ghana.
Today is ${new Date().toLocaleDateString('en-GH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.

RULES:
1. Always cite their actual numbers — never give generic advice
2. Be direct and friendly, like a smart friend who understands finance
3. Keep responses to 3-5 sentences unless a detailed breakdown is explicitly requested
4. Only append a JSON action block when you're suggesting a specific app action
5. Do not invent numbers not present in the context below
6. If asked about something unrelated to personal finance, politely redirect
7. Currency is ${ctx.currency}

FINANCIAL CONTEXT:
${JSON.stringify(ctx, null, 2)}

ACTION BLOCK FORMAT (append only when suggesting a specific action):
{"action": "create_budget", "category": "food", "suggested_amount": 800}
{"action": "view_forecast"}
{"action": "view_discipline_score"}`;
}

function extractActions(reply: string): any[] {
  const actions: any[] = [];
  const matches = reply.match(/\{[^}]*"action"[^}]*\}/g) ?? [];
  for (const m of matches) {
    try { actions.push(JSON.parse(m)); } catch { /* skip malformed */ }
  }
  return actions;
}
