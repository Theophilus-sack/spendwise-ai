import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.27.0';
import { authenticate, AuthError } from '../_shared/auth.ts';
import { enforceRateLimit, RateLimitError } from '../_shared/rateLimit.ts';
import { optionalString, ValidationError } from '../_shared/validate.ts';
import { CORS_HEADERS, json } from '../_shared/http.ts';
import { CLAUDE_MODEL } from '../_shared/anthropic.ts';

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });
// ~4.4MB of raw image data — plenty for a phone photo, bounded so a single
// request can't blow up latency/cost or hit Anthropic's request size limit.
const MAX_IMAGE_BASE64_LENGTH = 6_000_000;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  try {
    const { userId } = await authenticate(req);
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    await enforceRateLimit(supabase, userId, 'ocr-receipt', 15, 3600);

    const body = await req.json();
    const rawOcrText = optionalString(body.rawOcrText, 4000, 'rawOcrText');
    const imageBase64: string | undefined = body.imageBase64;
    if (imageBase64 && imageBase64.length > MAX_IMAGE_BASE64_LENGTH) {
      throw new ValidationError('Image is too large.');
    }

    let textToStructure = rawOcrText;

    // If we received a base64 image (from cloud Vision API path), use Claude vision directly
    if (imageBase64 && !rawOcrText) {
      const visionResponse = await anthropic.messages.create({
        model: CLAUDE_MODEL,
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
      model: CLAUDE_MODEL,
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
    if (err instanceof AuthError) return json({ error: err.message, confidence: 0, lineItems: [] }, 401);
    if (err instanceof ValidationError) return json({ error: err.message, confidence: 0, lineItems: [] }, 400);
    if (err instanceof RateLimitError) return json({ error: err.message, confidence: 0, lineItems: [] }, 429);
    return json({ error: err.message, confidence: 0, lineItems: [] }, 500);
  }
});
