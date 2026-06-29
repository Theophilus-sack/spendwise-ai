import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.27.0';

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders() });

  try {
    const { imageBase64, rawOcrText } = await req.json();

    let textToStructure = rawOcrText;

    // If we received a base64 image (from cloud Vision API path), use Claude vision directly
    if (imageBase64 && !rawOcrText) {
      const visionResponse = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        messages: [{
          role: 'user',
          content: [{
            type: 'image',
            source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 },
          }, {
            type: 'text',
            text: `Extract all text from this receipt image. Return only the raw text, preserving line breaks.`,
          }],
        }],
      });
      textToStructure = visionResponse.content[0].type === 'text' ? visionResponse.content[0].text : '';
    }

    if (!textToStructure) return json({ confidence: 0, lineItems: [] });

    // Structure the extracted text
    const structureResponse = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: `Extract expense information from this receipt text.
Return ONLY valid JSON with these exact fields. Use null if a field cannot be determined.

Receipt text:
"""
${textToStructure}
"""

Return this exact JSON structure:
{
  "merchant_name": "string or null",
  "total_amount": number or null,
  "currency": "GHS or null",
  "date": "YYYY-MM-DD or null",
  "suggested_category": "food|transport|groceries|bills|shopping|entertainment|health|education|rent|other",
  "confidence": 0.0 to 1.0,
  "line_items": [{"name": "string", "amount": number}]
}

Rules:
- total_amount is the FINAL total (after tax), not a subtotal
- Convert DD/MM/YYYY dates to YYYY-MM-DD format
- GH₵ or GHS means Ghanaian Cedis
- Merchant name is usually at the top of the receipt`,
      }],
    });

    const text = structureResponse.content[0].type === 'text' ? structureResponse.content[0].text.trim() : '{}';
    const match = text.match(/\{[\s\S]*\}/);
    const result = match ? JSON.parse(match[0]) : { confidence: 0, lineItems: [] };

    return json({
      merchantName:      result.merchant_name,
      totalAmount:       result.total_amount,
      currency:          result.currency ?? 'GHS',
      date:              result.date,
      suggestedCategory: result.suggested_category ?? 'other',
      confidence:        Number(result.confidence) || 0.5,
      lineItems:         result.line_items ?? [],
    });
  } catch (err: any) {
    return json({ error: err.message, confidence: 0, lineItems: [] }, 500);
  }
});

const corsHeaders = () => ({
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
});
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...corsHeaders() } });
