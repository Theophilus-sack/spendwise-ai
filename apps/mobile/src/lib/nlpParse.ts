import { callEdgeFunction } from './supabase';
import {
  todayISO, parseExpensesLocally, generateUUID, findMerchantCategoryOverride,
} from '@spendwise/shared';
import type { DraftExpense, ExpenseCategory, PaymentMethod, Expense } from '@spendwise/shared';

export interface ParsedExpense {
  amount?: number; description?: string; merchant_name?: string;
  category?: ExpenseCategory; date?: string; payment_method?: PaymentMethod;
  confidence?: number;
}

// Items with no usable amount are dropped rather than surfaced as a draft
// the user would just have to discard.
function toDrafts(parsed: ParsedExpense[], today: string, source: DraftExpense['source']): DraftExpense[] {
  return parsed
    .filter((p) => typeof p.amount === 'number' && p.amount > 0)
    .map((p) => ({
      id:            generateUUID(),
      source,
      selected:      true,
      amount:        p.amount!,
      category:      p.category ?? 'other',
      merchantName:  p.merchant_name,
      description:   p.description,
      paymentMethod: p.payment_method ?? 'mobile_money',
      date:          p.date ?? today,
      confidence:    p.confidence,
    }));
}

// A client-side safety net on top of whatever the parser (cloud or offline)
// already decided — catches a known merchant/item even if the edge
// function's own history lookup missed it (e.g. a very recent expense that
// hasn't synced to the server yet). Exported for statement import too, which
// builds drafts from a different edge function but wants the same guarantee.
export function applyLocalOverrides(drafts: DraftExpense[], history: Expense[]): DraftExpense[] {
  return drafts.map((d) => {
    const override = findMerchantCategoryOverride(d.merchantName, d.description, history);
    return override ? { ...d, category: override.category, confidence: override.confidence } : d;
  });
}

/**
 * Free text → reviewable draft expenses. Shared by Quick Add (typed) and
 * Voice entry (transcribed) — both just get free text from a different
 * input method and need the exact same parse → override → draft pipeline.
 * Falls back to the fully offline parser when the cloud one is unreachable.
 */
export async function parseTextToDrafts(
  text: string,
  history: Expense[],
  source: DraftExpense['source'],
): Promise<DraftExpense[]> {
  const today = todayISO();
  try {
    const result = await callEdgeFunction<{ expenses: ParsedExpense[] }>(
      'parse-nlp-expense', { input: text, today },
    );
    return applyLocalOverrides(toDrafts(result.expenses ?? [], today, source), history);
  } catch {
    const local = parseExpensesLocally(text, today);
    const drafts: DraftExpense[] = local.map((l) => ({
      id:            generateUUID(),
      source,
      selected:      true,
      amount:        l.amount!,
      category:      l.category,
      description:   l.description,
      paymentMethod: 'mobile_money' as PaymentMethod,
      date:          l.date,
      confidence:    l.confidence,
    }));
    return applyLocalOverrides(drafts, history);
  }
}
