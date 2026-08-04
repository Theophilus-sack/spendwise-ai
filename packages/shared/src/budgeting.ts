import { DEFAULT_BUDGET_PCT } from './constants';
import type { SpendingPersonality } from './types';

export interface GeneratedBudgetLine {
  category: string;
  limit: number;
}

/**
 * Splits monthly income into a budget that always tallies exactly with
 * income: `savings` gets precisely `savingsTargetPct` of income, and every
 * other category splits the *remaining* income proportionally by
 * DEFAULT_BUDGET_PCT's relative weights (personality-skewed, then
 * re-normalized so they still sum to exactly the remainder — the personality
 * multiplier changes the split, never the total).
 *
 * Shared between onboarding (building the starter budget) and the "update my
 * budgets to match" flow when a user changes their income later — one
 * formula, so the two can't silently drift apart the way FDS once did.
 */
export function generateIncomeBasedBudgets(
  monthlyIncome: number,
  savingsTargetPct: number,
  personality: SpendingPersonality | string = 'balanced',
): GeneratedBudgetLine[] {
  const multiplier = personality === 'saver' ? 0.8 : personality === 'spender' ? 1.1 : 1.0;
  const savingsAmount = Math.round(monthlyIncome * savingsTargetPct / 10) * 10;
  const remaining = monthlyIncome - savingsAmount;

  const weighted = Object.entries(DEFAULT_BUDGET_PCT)
    .filter(([, pct]) => (pct ?? 0) > 0)
    .map(([category, pct]) => ({ category, weight: (pct ?? 0) * multiplier }));
  const totalWeight = weighted.reduce((s, w) => s + w.weight, 0);

  const budgets = weighted.map(({ category, weight }) => ({
    category,
    limit: totalWeight > 0 ? Math.round(remaining * (weight / totalWeight) / 10) * 10 : 0,
  }));

  return [...budgets, { category: 'savings', limit: savingsAmount }];
}
