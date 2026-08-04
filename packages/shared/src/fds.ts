import { FDS_WEIGHTS } from './constants';
import { clamp } from './utils';
import type { FDSComponents, FDSResult } from './types';

export interface FDSInputs {
  categoriesOverBudget: number;
  totalCategories: number;
  actualSavings: number;
  targetSavings: number;
  daysLogged: number;
  daysInPeriod: number;
  previousScore: number | null;
  /** Whether the user completed that week's reflection — adds REFLECTION_BONUS
   *  before the final clamp, same as the live formula. */
  hasReflection?: boolean;
}

/** Flat bonus for completing that week's reflection — see the identical
 *  constant in supabase/functions/_shared/fds.ts for why it's kept separate
 *  from the four weighted components rather than folded into the formula. */
export const REFLECTION_BONUS = 2;

/**
 * Financial Discipline Score — composite metric (0–100)
 *
 * Components (justified by behavioural finance literature):
 *   Budget Adherence (35%) — primary driver of financial health (Kahneman 2011)
 *   Savings Rate     (30%) — core measure of financial discipline (Thaler & Sunstein)
 *   Consistency      (20%) — habit formation theory (Duhigg 2012)
 *   Improvement      (15%) — growth mindset; rewards progress not just absolute performance
 *
 * Smoothed with EMA (α=0.7) to prevent single-week volatility distorting the trend.
 *
 * IMPORTANT — this is an intentional duplicate of supabase/functions/_shared/fds.ts's
 * `computeFDS`, not a shared import: Supabase Edge Functions run on Deno and are
 * deployed as a self-contained bundle of just their own file tree, so they can't
 * reach across the repo into this npm workspace package at runtime (confirmed —
 * no edge function imports from @spendwise/shared anywhere in this codebase).
 * This pure version exists so the formula is unit-testable and backtestable
 * without a live Supabase connection. It was previously missing the reflection
 * bonus the live version has, which is exactly the kind of silent drift this
 * comment exists to prevent happening again — if you change the weights,
 * smoothing, or bonus in one file, change it in both.
 */
export function computeFDS(inputs: FDSInputs): FDSResult {
  const {
    categoriesOverBudget,
    totalCategories,
    actualSavings,
    targetSavings,
    daysLogged,
    daysInPeriod,
    previousScore,
  } = inputs;

  // Component 1: Budget Adherence — partial credit per category
  const budgetAdherence = clamp(totalCategories > 0
    ? 1 - (categoriesOverBudget / totalCategories)
    : 1, 0, 1);

  // Component 2: Savings Rate — clamped to [0,1] (over-saving doesn't inflate score;
  // a negative savings rate, i.e. spending more than target, floors at 0 rather than
  // dragging the whole weighted score below its intended range)
  const savingsRate = clamp(targetSavings > 0
    ? actualSavings / targetSavings
    : actualSavings > 0 ? 0.5 : 0, 0, 1);

  // Component 3: Consistency — fraction of period days with at least one expense logged
  const consistency = clamp(daysInPeriod > 0 ? daysLogged / daysInPeriod : 0, 0, 1);

  // Component 4: Improvement Trend — sigmoid on delta to prevent outlier weeks dominating
  // +10 pt delta → 0.73, -10 pt delta → 0.27, flat → 0.50
  const rawScore =
    (budgetAdherence * FDS_WEIGHTS.budgetAdherence) +
    (savingsRate     * FDS_WEIGHTS.savingsRate) +
    (consistency     * FDS_WEIGHTS.consistency) +
    (0.5             * FDS_WEIGHTS.improvement); // neutral until we have previous score

  const delta = previousScore !== null ? rawScore * 100 - previousScore : 0;
  const improvement = 1 / (1 + Math.exp(-delta / 10));

  const weightedRaw =
    (budgetAdherence * FDS_WEIGHTS.budgetAdherence) +
    (savingsRate     * FDS_WEIGHTS.savingsRate) +
    (consistency     * FDS_WEIGHTS.consistency) +
    (improvement     * FDS_WEIGHTS.improvement);

  const rawFinal = weightedRaw * 100;

  // EMA smoothing (α=0.7) against last week's score
  const emaAlpha = 0.7;
  const smoothed = previousScore !== null
    ? emaAlpha * rawFinal + (1 - emaAlpha) * previousScore
    : rawFinal;

  const reflectionBonus = inputs.hasReflection ? REFLECTION_BONUS : 0;

  // Final defensive clamp: components above are each already bounded to [0,1] and the
  // weights sum to 1, so this should be a no-op in practice — it exists so a future
  // caller passing an out-of-range previousScore (e.g. corrupted stored data) still
  // can't push the displayed score outside the documented 0–100 range.
  const score = clamp(Math.round((smoothed + reflectionBonus) * 10) / 10, 0, 100);

  const components: FDSComponents = {
    budgetAdherence: Math.round(budgetAdherence * 1000) / 1000,
    savingsRate:     Math.round(savingsRate * 1000) / 1000,
    consistency:     Math.round(consistency * 1000) / 1000,
    improvement:     Math.round(improvement * 1000) / 1000,
  };

  return {
    score,
    components,
    grade: scoreToGrade(score),
    trend: delta > 2 ? 'improving' : delta < -2 ? 'declining' : 'stable',
  };
}

export function scoreToGrade(score: number): FDSResult['grade'] {
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 55) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

export function fdsGradeColor(grade: FDSResult['grade']): string {
  const map: Record<FDSResult['grade'], string> = {
    A: '#2ECC71',
    B: '#1A6B4A',
    C: '#F5A623',
    D: '#E67E22',
    F: '#E74C3C',
  };
  return map[grade];
}
