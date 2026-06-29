import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.27.0';

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });

const CATEGORIES = ['food','transport','groceries','bills','shopping','entertainment','health','education','rent','savings','other'];

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders() });

  try {
    const { description, amount, merchantHint } = await req.json();
    const input = `${description ?? ''} ${merchantHint ?? ''}`.trim();

    if (!input) return json({ category: 'other', confidence: 0.4 });

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
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
"Silverbird Cinema, ₵80" → {"category": "entertainment", "confidence": 0.95}

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
    return json({ category: 'other', confidence: 0.4 });
  }
});

const corsHeaders = () => ({
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
});
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...corsHeaders() } });
