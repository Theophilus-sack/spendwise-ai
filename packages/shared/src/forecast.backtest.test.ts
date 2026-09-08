import { describe, test, expect } from 'bun:test';
import { forecastMonthEnd, computeDayOfWeekMultipliers } from './forecast';
import type { DailyTotal } from './forecast';

/**
 * Synthetic backtest for the Weighted Exponential Smoothing (WES) forecast.
 *
 * Same scope note as fds.backtest.test.ts: synthetic data with a KNOWN true
 * generating rate, not real historical accuracy data. What this validates:
 * whether the stated confidence tiers (low <7 days, medium 7-14, high 15+)
 * actually correlate with lower forecast error — the claim the UI makes by
 * showing a confidence label at all — and surfaces any structural blind
 * spots in the algorithm itself.
 */

// Deterministic PRNG (mulberry32) so every run of this backtest reproduces
// the exact same "random" noise — a real backtest has to be re-runnable.
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildFlatSeriesWithNoise(days: number, dailyRate: number, noisePct: number, seed: number): DailyTotal[] {
  const rand = mulberry32(seed);
  return Array.from({ length: days }, (_, i) => ({
    date: `2026-01-${String(i + 1).padStart(2, '0')}`,
    amount: Math.max(0, dailyRate * (1 + (rand() * 2 - 1) * noisePct)),
  }));
}

describe('Forecast — confidence tier boundaries match the documented thresholds', () => {
  test('below 7 days of history is "low" confidence', () => {
    const series = buildFlatSeriesWithNoise(5, 100, 0.1, 1);
    expect(forecastMonthEnd(series, 5, 30).confidence).toBe('low');
  });

  test('7–14 days of history is "medium" confidence', () => {
    const series = buildFlatSeriesWithNoise(10, 100, 0.1, 1);
    expect(forecastMonthEnd(series, 10, 30).confidence).toBe('medium');
  });

  test('15+ days of history is "high" confidence', () => {
    const series = buildFlatSeriesWithNoise(20, 100, 0.1, 1);
    expect(forecastMonthEnd(series, 20, 30).confidence).toBe('high');
  });
});

describe('Forecast — does "confidence" actually mean lower error?', () => {
  const DAILY_RATE = 100;
  const DAYS_IN_MONTH = 30;
  const TRIALS = 40;

  function trialError(historyDays: number, seed: number): number {
    const series = buildFlatSeriesWithNoise(historyDays, DAILY_RATE, 0.35, seed);
    const result = forecastMonthEnd(series, historyDays, DAYS_IN_MONTH);
    const trueEndOfMonth = DAILY_RATE * DAYS_IN_MONTH;
    return Math.abs(result.projectedMonthEnd - trueEndOfMonth) / trueEndOfMonth;
  }

  test('average forecast error decreases as confidence tier rises (low > medium > high), across many trials', () => {
    const lowErrors    = Array.from({ length: TRIALS }, (_, i) => trialError(4, i));
    const mediumErrors = Array.from({ length: TRIALS }, (_, i) => trialError(10, i + 1000));
    const highErrors   = Array.from({ length: TRIALS }, (_, i) => trialError(20, i + 2000));

    const avg = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
    const avgLow = avg(lowErrors), avgMedium = avg(mediumErrors), avgHigh = avg(highErrors);

    expect(avgMedium).toBeLessThan(avgLow);
    expect(avgHigh).toBeLessThan(avgMedium);
  });
});

describe('Forecast — day-of-week seasonality', () => {
  test('computeDayOfWeekMultipliers correctly detects a weekend-heavy pattern', () => {
    // 3 weeks of data: Fri/Sat/Sun cost 3x every other day.
    const series: DailyTotal[] = [];
    const start = new Date('2026-01-05T00:00:00'); // a Monday
    for (let i = 0; i < 21; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const dow = d.getDay();
      const isWeekendish = dow === 5 || dow === 6 || dow === 0;
      series.push({ date: d.toISOString().slice(0, 10), amount: isWeekendish ? 150 : 50 });
    }
    const multipliers = computeDayOfWeekMultipliers(series);
    expect(multipliers[5]).toBeGreaterThan(1.5);
    expect(multipliers[1]).toBeLessThan(1);
  });

  function buildSeasonalSeries(days: number, start: Date): DailyTotal[] {
    const series: DailyTotal[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const dow = d.getDay();
      const isWeekendish = dow === 5 || dow === 6 || dow === 0;
      series.push({ date: d.toISOString().slice(0, 10), amount: isWeekendish ? 214 : 71 });
    }
    return series;
  }

  function total(series: DailyTotal[]): number {
    return series.reduce((sum, day) => sum + day.amount, 0);
  }

  test('without todayISO, forecastMonthEnd ignores the pattern — error is materially worse for a seasonal spender than a flat one', () => {
    const flatSeries = buildFlatSeriesWithNoise(12, 100, 0.05, 42);
    const flatResult = forecastMonthEnd(flatSeries, 12, 30);
    const flatTrueMonthlyTotal = 100 * 30;
    const flatError = Math.abs(flatResult.projectedMonthEnd - flatTrueMonthlyTotal) / flatTrueMonthlyTotal;

    // Generate the complete synthetic month first so the backtest ground truth
    // is the actual total implied by the same seasonal data-generating process.
    const start = new Date('2026-01-01T00:00:00'); // Thursday
    const fullSeasonalMonth = buildSeasonalSeries(30, start);
    const seasonalDaily = fullSeasonalMonth.slice(0, 12);
    const trueMonthlyTotal = total(fullSeasonalMonth);

    const seasonalResult = forecastMonthEnd(seasonalDaily, 12, 30);
    const seasonalErrorNoAwareness =
      Math.abs(seasonalResult.projectedMonthEnd - trueMonthlyTotal) / trueMonthlyTotal;

    expect(seasonalErrorNoAwareness).toBeGreaterThan(flatError);
  });

  test('with todayISO supplied, the day-of-week-aware projection meaningfully closes that error gap', () => {
    const start = new Date('2026-01-01T00:00:00'); // Thursday
    const fullSeasonalMonth = buildSeasonalSeries(30, start);
    const seasonalDaily = fullSeasonalMonth.slice(0, 12);
    const todayISO = seasonalDaily[seasonalDaily.length - 1].date; // 2026-01-12
    const trueMonthlyTotal = total(fullSeasonalMonth);

    const withoutAwareness = forecastMonthEnd(seasonalDaily, 12, 30);
    const withAwareness = forecastMonthEnd(seasonalDaily, 12, 30, undefined, todayISO);

    const errorWithout =
      Math.abs(withoutAwareness.projectedMonthEnd - trueMonthlyTotal) / trueMonthlyTotal;
    const errorWith =
      Math.abs(withAwareness.projectedMonthEnd - trueMonthlyTotal) / trueMonthlyTotal;

    expect(errorWith).toBeLessThan(errorWithout);
  });

  test('below a week of history, todayISO is a no-op — too little data to trust a day-of-week pattern', () => {
    const shortSeries = buildFlatSeriesWithNoise(5, 100, 0.05, 7);
    const todayISO = shortSeries[shortSeries.length - 1].date;
    const without = forecastMonthEnd(shortSeries, 5, 30);
    const withToday = forecastMonthEnd(shortSeries, 5, 30, undefined, todayISO);
    expect(withToday.projectedMonthEnd).toBeCloseTo(without.projectedMonthEnd, 5);
  });
});
