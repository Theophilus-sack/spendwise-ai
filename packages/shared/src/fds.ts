import { FDS_WEIGHTS } from './constants';
import type { FDSComponents, FDSResult } from './types';

export interface FDSInputs {
  categoriesOverBudget: number;
  totalCategories: number;
  actualSavings: number;
  targetSavings: number;
  daysLogged: number;
  daysInPeriod: number;
  previousScore: number | null;
}

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
  const budgetAdherence = totalCategories > 0
    ? 1 - (categoriesOverBudget / totalCategories)
    : 1;

  // Component 2: Savings Rate — capped at 1.0 (over-saving doesn't inflate score)
  const savingsRate = targetSavings > 0
    ? Math.min(actualSavings / targetSavings, 1.0)
    : actualSavings > 0 ? 0.5 : 0;

  // Component 3: Consistency — fraction of period days with at least one expense logged
  const consistency = daysInPeriod > 0 ? daysLogged / daysInPeriod : 0;

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

  const score = Math.round(smoothed * 10) / 10;

  const components: FDSComponents = {
    budgetAdherence: Math.round(budgetAdherence * 1000) / 1000,
    savingsRate:     Math.round(savingsRate * 1000) / 1000,
    consistency:     Math.round(consistency * 1000) / 1000,
    improvement:     Math.round(improvement * 1000) / 1000,
  };

  return {
    score,
    components,
    grade: toGrade(score),
    trend: delta > 2 ? 'improving' : delta < -2 ? 'declining' : 'stable',
  };
}

function toGrade(score: number): FDSResult['grade'] {
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
