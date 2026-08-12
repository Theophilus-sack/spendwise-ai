import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.27.0';
import { authenticate, AuthError } from '../_shared/auth.ts';
import { enforceRateLimit, RateLimitError } from '../_shared/rateLimit.ts';
import { ValidationError } from '../_shared/validate.ts';
import { CORS_HEADERS, json } from '../_shared/http.ts';
import { CLAUDE_MODEL } from '../_shared/anthropic.ts';
import { findCategoryOverride, buildFewShotLines } from '../_shared/categoryHistory.ts';

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });
// ~11MB of raw file data — a multi-page bank/MoMo statement PDF or a photo
// of one is bigger than a single receipt photo, but still bounded so one
// request can't blow up latency/cost or hit Anthropic's request size limit.
const MAX_FILE_BASE64_LENGTH = 15_000_000;

const TRANSACTION_SCHEMA = {
  type: 'object',
  properties: {
    date:        { type: 'string', description: 'YYYY-MM-DD' },
    description: { type: 'string' },
    merchant_name: { type: ['string', 'null'] },
    amount:      { type: 'number', description: 'Always positive, regardless of direction' },
    direction:   { type: 'string', enum: ['debit', 'credit'] },
    suggested_category: {
      type: 'string',
      enum: ['food', 'transport', 'groceries', 'bills', 'shopping', 'entertainment', 'health', 'education', 'rent', 'other'],
    },
  },
  required: ['date', 'description', 'amount', 'direction', 'suggested_category'],
};

const EXTRACT_TRANSACTIONS_TOOL = {
  name: 'extract_transactions',
  description: 'Extract every transaction line from a bank or mobile money statement.',
  input_schema: {
    type: 'object',
    properties: {
      transactions: { type: 'array', items: TRANSACTION_SCHEMA },
    },
    required: ['transactions'],
  },
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  try {
    const { userId } = await authenticate(req);
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    // Lower cap than ocr-receipt — a statement is a much heavier request
    // (larger file, more output tokens), and imports are an occasional
    // bulk action rather than a per-expense one.
    await enforceRateLimit(supabase, userId, 'import-statement', 8, 3600);

    const body = await req.json();
    const pdfBase64: string | undefined = body.pdfBase64;
    const imageBase64: string | undefined = body.imageBase64;

    if (!pdfBase64 && !imageBase64) {
      throw new ValidationError('Provide either pdfBase64 or imageBase64.');
    }
    const file = pdfBase64 ?? imageBase64!;
    if (file.length > MAX_FILE_BASE64_LENGTH) {
      throw new ValidationError('File is too large.');
    }

    // The picked file's actual type has to be honored — a PNG screenshot
    // sent with an "image/jpeg" label fails to decode on Claude's end and
    // silently yields zero transactions rather than an obvious error.
    const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const;
    type SupportedImageType = (typeof SUPPORTED_IMAGE_TYPES)[number];
    const requestedImageType = body.imageMimeType as string | undefined;
    const imageMediaType: SupportedImageType = SUPPORTED_IMAGE_TYPES.includes(requestedImageType as SupportedImageType)
      ? (requestedImageType as SupportedImageType)
      : 'image/jpeg';

    const fileBlock = pdfBase64
      ? { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: pdfBase64 } }
      : { type: 'image' as const, source: { type: 'base64' as const, media_type: imageMediaType, data: imageBase64! } };

    // Learn from this user's own history — same personalization every other
    // categorization endpoint applies, so imported transactions land in the
    // same categories this user already uses for the same merchants.
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
      // A month of MoMo activity can easily be 60-80+ transactions across
      // several pages — 4000 was tuned for a much shorter statement and
      // risked truncating mid-array on a real one.
      max_tokens: 8000,
      tools: [EXTRACT_TRANSACTIONS_TOOL],
      tool_choice: { type: 'tool', name: 'extract_transactions' },
      messages: [{
        role: 'user',
        content: [
          fileBlock,
          {
            type: 'text',
            text: `Extract every transaction row from this statement — read every page, not just the first. This may be a bank statement or an MTN/Telecel mobile money statement.

MTN MOBILE MONEY STATEMENTS specifically have this table format — recognize it and use these exact rules:
Columns: TRANSACTION DATE | FROM ACCT | FROM NAME | FROM NO. | TRANS. TYPE | AMOUNT | FEES | E-LEVY | BAL BEFORE | BAL AFTER | TO NO. | TO NAME | TO ACCT | F_ID | REF | OVA

- The statement header names the account holder ("ACCOUNT HOLDER NAME: ..."). Every row is from their perspective.
- Determine direction by comparing BAL BEFORE and BAL AFTER, not by the TRANS. TYPE label alone (TRANS. TYPE "TRANSFER" can be money going either way):
  - BAL AFTER > BAL BEFORE → "credit" (money came in)
  - BAL AFTER < BAL BEFORE → "debit" (money went out)
- amount is the AMOUNT column value (not FEES or E-LEVY), always positive.
- The counterparty (for description/merchant_name) is whichever of FROM NAME / TO NAME is NOT the account holder.
- The REF column is often a short human-written note about what the payment was for (e.g. "Food", "Water", "Bread", "Jollof", "Laundry") — when REF is a real word like that (not a single stray letter), use it as the description instead of just the counterparty's name, since it's more informative.
- Recognize common system counterparties: "MTNONLINEAIRTIMEVENDOR" and "TELECEL PUSH OVA" rows are airtime/data bundle purchases (category "bills"); a "Paystack"/"HubtelPOS" counterparty with a REF revealing a real merchant (e.g. "...Chowdeck payment") means the real merchant is the one named in the REF, not Paystack/Hubtel itself.
- SKIP rows that are the account holder moving money between their OWN accounts — recognizable by the account holder's own name appearing as the counterparty, often with REF text like "Credit from ABGH Absa Bank Ghana" or "GIPS Transfer from GCB Bank" (topping up MoMo from their own bank account). These aren't income or spending, just internal float movement — do not include them in the output at all.
- CASH_OUT rows (withdrawing to an agent) are debits with no clear category — use "other" unless REF says otherwise.

For every transaction you output:
- date: convert to YYYY-MM-DD
- amount: always positive, regardless of direction
- direction: "debit" for money leaving the account, "credit" for money coming in
- suggested_category: your best guess for debits; use "other" for credits since income isn't a spending category

Ghana context for category: Bolt/Yango/Uber/trotro → transport, Shoprite/Melcom/market → groceries, MTN/Vodafone/DSTV/electricity → bills, mobile money transfer for rent → rent (not bills).${personalization}`,
          },
        ],
      }],
    });

    const toolUse = message.content.find((c): c is Anthropic.ToolUseBlock => c.type === 'tool_use');
    const rawTransactions = ((toolUse?.input as { transactions?: Array<Record<string, unknown>> } | undefined)?.transactions ?? []);

    // An exact match on this user's own history beats whatever Claude
    // guessed — it's not a guess, it's what they already decided.
    const transactions = rawTransactions.map((t) => {
      const override = findCategoryOverride(
        t.merchant_name as string | undefined,
        t.description as string | undefined,
        history ?? [],
      );
      return override ? { ...t, suggested_category: override.category } : t;
    });

    return json({ transactions });
  } catch (err: any) {
    if (err instanceof AuthError) return json({ error: err.message }, 401);
    if (err instanceof ValidationError) return json({ error: err.message }, 400);
    if (err instanceof RateLimitError) return json({ error: err.message }, 429);
    return json({ error: err.message }, 500);
  }
});
