import { describe, test, expect } from 'bun:test';
import { computeFDS, scoreToGrade, REFLECTION_BONUS } from './fds';
import { FDS_WEIGHTS } from './constants';
import type { FDSInputs } from './fds';
import type { FDSResult } from './types';

/**
 * Synthetic backtest for the Financial Discipline Score formula.
 *
 * IMPORTANT SCOPE NOTE: this is a validity/sanity check against synthetic,
 * hand-constructed behavior archetypes with a known ground truth — NOT an
 * empirical validation against real users' actual financial outcomes. The
 * app is too early for that: a real validation would need months of real
 * usage across many users to check whether a higher score actually predicts
 * something (e.g. fewer overdrafts, higher realized savings) — data that
 * doesn't exist yet. What this DOES verify: the formula is internally
 * consistent, numerically stable, and actually separates good financial
 * behavior from bad — the minimum bar for the score to mean anything at all.
 */

interface WeekInputs {
  categoriesOverBudget: number;
  totalCategories: number;
  actualSavings: number;
  targetSavings: number;
  daysLogged: number;
  hasReflection?: boolean;
}

function runWeeks(weeks: WeekInputs[]): FDSResult[] {
  const results: FDSResult[] = [];
  let previousScore: number | null = null;
  for (const w of weeks) {
    const inputs: FDSInputs = { ...w, daysInPeriod: 7, previousScore };
    const result = computeFDS(inputs);
    results.push(result);
    previousScore = result.score;
  }
  return results;
}

const DISCIPLINED: WeekInputs = { categoriesOverBudget: 0, totalCategories: 5, actualSavings: 550, targetSavings: 500, daysLogged: 7 };
const CHRONICALLY_POOR: WeekInputs = { categoriesOverBudget: 5, totalCategories: 5, actualSavings: 0, targetSavings: 500, daysLogged: 1 };
const MODERATE: WeekInputs = { categoriesOverBudget: 2, totalCategories: 5, actualSavings: 250, targetSavings: 500, daysLogged: 4 };

describe('FDS — structural integrity', () => {
  test('component weights sum to exactly 1', () => {
    const sum = FDS_WEIGHTS.budgetAdherence + FDS_WEIGHTS.savingsRate + FDS_WEIGHTS.consistency + FDS_WEIGHTS.improvement;
    expect(sum).toBeCloseTo(1, 10);
  });
});

describe('FDS — bounds hold across a wide behavior range', () => {
  test('score is always within [0, 100] and never NaN, over 12 weeks of every archetype', () => {
    for (const archetype of [DISCIPLINED, CHRONICALLY_POOR, MODERATE]) {
      const results = runWeeks(Array(12).fill(archetype));
      for (const r of results) {
        expect(Number.isNaN(r.score)).toBe(false);
        expect(r.score).toBeGreaterThanOrEqual(0);
        expect(r.score).toBeLessThanOrEqual(100);
      }
    }
  });

  test('extreme/malformed inputs (zero categories, zero target savings) do not produce NaN', () => {
    const result = computeFDS({
      categoriesOverBudget: 0, totalCategories: 0, actualSavings: 0, targetSavings: 0,
      daysLogged: 0, daysInPeriod: 7, previousScore: null,
    });
    expect(Number.isNaN(result.score)).toBe(false);
  });
});

describe('FDS — separates good behavior from bad (the core validity claim)', () => {
  const disciplinedResults = runWeeks(Array(12).fill(DISCIPLINED));
  const moderateResults    = runWeeks(Array(12).fill(MODERATE));
  const poorResults        = runWeeks(Array(12).fill(CHRONICALLY_POOR));

  const avg = (rs: FDSResult[]) => rs.reduce((s, r) => s + r.score, 0) / rs.length;

  test('disciplined > moderate > chronically poor, on average over 12 weeks', () => {
    expect(avg(disciplinedResults)).toBeGreaterThan(avg(moderateResults));
    expect(avg(moderateResults)).toBeGreaterThan(avg(poorResults));
  });

  test('a consistently disciplined archetype settles at grade A or B', () => {
    const finalGrade = disciplinedResults[disciplinedResults.length - 1].grade;
    expect(['A', 'B']).toContain(finalGrade);
  });

  test('a chronically poor archetype settles at grade D or F', () => {
    const finalGrade = poorResults[poorResults.length - 1].grade;
    expect(['D', 'F']).toContain(finalGrade);
  });
});

describe('FDS — trend classification tracks real direction of change', () => {
  test('an archetype improving linearly over 12 weeks ends higher than it starts, with more "improving" weeks in the back half', () => {
    const weeks: WeekInputs[] = Array.from({ length: 12 }, (_, i) => {
      const t = i / 11; // 0 → 1
      return {
        categoriesOverBudget: Math.round(5 - 5 * t),
        totalCategories: 5,
        actualSavings: 100 + 400 * t,
        targetSavings: 500,
        daysLogged: Math.round(2 + 5 * t),
      };
    });
    const results = runWeeks(weeks);
    expect(results[11].score).toBeGreaterThan(results[0].score + 15);

    const frontHalfImproving = results.slice(0, 6).filter(r => r.trend === 'improving').length;
    const backHalfImproving  = results.slice(6).filter(r => r.trend === 'improving').length;
    expect(backHalfImproving).toBeGreaterThanOrEqual(frontHalfImproving);
  });

  test('the mirror-image declining archetype ends lower than it starts', () => {
    const weeks: WeekInputs[] = Array.from({ length: 12 }, (_, i) => {
      const t = i / 11;
      return {
        categoriesOverBudget: Math.round(5 * t),
        totalCategories: 5,
        actualSavings: 500 - 400 * t,
        targetSavings: 500,
        daysLogged: Math.round(7 - 5 * t),
      };
    });
    const results = runWeeks(weeks);
    expect(results[11].score).toBeLessThan(results[0].score - 5);
  });
});

describe('FDS — EMA smoothing actually dampens single-week volatility', () => {
  test('an alternating perfect/terrible pattern swings less than the raw unsmoothed week-to-week values would', () => {
    const alternating: WeekInputs[] = Array.from({ length: 8 }, (_, i) =>
      i % 2 === 0 ? DISCIPLINED : CHRONICALLY_POOR,
    );
    const results = runWeeks(alternating);
    const scoreSwings = results.slice(1).map((r, i) => Math.abs(r.score - results[i].score));
    const maxSwing = Math.max(...scoreSwings);

    // Without smoothing, alternating between these two archetypes' raw scores
    // would swing close to the full distance between a near-perfect and a
    // near-zero week. With α=0.7 smoothing pulling 30% toward the previous
    // (opposite-extreme) score, the realized swing should be reduced.
    const rawDisciplined = runWeeks([DISCIPLINED])[0].score;
    const rawPoor = runWeeks([CHRONICALLY_POOR])[0].score;
    const unsmoothedGap = Math.abs(rawDisciplined - rawPoor);

    expect(maxSwing).toBeLessThan(unsmoothedGap);
  });
});

describe('FDS — reflection bonus', () => {
  test('completing the weekly reflection adds exactly REFLECTION_BONUS points, unless clamped at 100', () => {
    const base: FDSInputs = {
      categoriesOverBudget: 1, totalCategories: 5, actualSavings: 300, targetSavings: 500,
      daysLogged: 5, daysInPeriod: 7, previousScore: null,
    };
    const without = computeFDS({ ...base, hasReflection: false });
    const withBonus = computeFDS({ ...base, hasReflection: true });
    expect(withBonus.score - without.score).toBeCloseTo(REFLECTION_BONUS, 5);
  });

  test('the bonus cannot push the score above 100', () => {
    const nearMax: FDSInputs = {
      categoriesOverBudget: 0, totalCategories: 5, actualSavings: 1000, targetSavings: 500,
      daysLogged: 7, daysInPeriod: 7, previousScore: 100, hasReflection: true,
    };
    const result = computeFDS(nearMax);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});

describe('FDS — grade thresholds match scoreToGrade in isolation', () => {
  const cases: Array<[number, FDSResult['grade']]> = [
    [95, 'A'], [85, 'A'], [84.9, 'B'], [70, 'B'], [69.9, 'C'],
    [55, 'C'], [54.9, 'D'], [40, 'D'], [39.9, 'F'], [0, 'F'],
  ];
  test.each(cases)('score %p → grade %p', (score, grade) => {
    expect(scoreToGrade(score)).toBe(grade);
  });
});
