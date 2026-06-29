import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.27.0';

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders() });

  try {
    const { input, today } = await req.json();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 150,
      messages: [{
        role: 'user',
        content: `Extract expense details from this natural language input.
Return ONLY valid JSON. Use null for any field you cannot determine.

Today's date: ${today}
Yesterday: ${yesterdayStr}
User's currency: GHS

Input: "${input}"

Return:
{
  "amount": number or null,
  "description": "string or null",
  "merchant_name": "string or null",
  "category": "food|transport|groceries|bills|shopping|entertainment|health|education|rent|other|null",
  "date": "YYYY-MM-DD or null",
  "payment_method": "mobile_money|card|cash|null",
  "confidence": 0.0 to 1.0
}

Examples:
"spent 80 cedis on bolt this morning" → {"amount": 80, "merchant_name": "Bolt", "category": "transport", "date": "${today}", "payment_method": null, "confidence": 0.95}
"bought lunch at papaye yesterday, 65 ghana" → {"amount": 65, "merchant_name": "Papaye", "category": "food", "date": "${yesterdayStr}", "confidence": 0.92}
"paid dstv 120 momo" → {"amount": 120, "merchant_name": "DSTV", "category": "bills", "date": "${today}", "payment_method": "mobile_money", "confidence": 0.97}`,
      }],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text.trim() : '{}';
    const match = text.match(/\{[\s\S]*?\}/);
    const result = match ? JSON.parse(match[0]) : {};

    return json(result);
  } catch (err: any) {
    return json({ error: err.message }, 500);
  }
});

const corsHeaders = () => ({
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
});
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...corsHeaders() } });
