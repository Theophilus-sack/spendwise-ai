import { FORECAST_ALPHA, FORECAST_AT_RISK_PCT } from './constants';
import type { ForecastResult, CategoryForecast, ExpenseCategory } from './types';

export interface DailyTotal {
  date: string;  // YYYY-MM-DD
  amount: number;
}

export interface CategoryDailyTotal extends DailyTotal {
  category: ExpenseCategory;
}

/**
 * Weighted Exponential Smoothing Forecast
 *
 * Recent days are weighted more heavily via exponential decay (α=0.85).
 * Yesterday counts 85% as much as today, two days ago 72%, three days 61%, etc.
 *
 * Accuracy improves after 7+ days of data (medium confidence) and 15+ (high).
 * Below 3 days we return low confidence and should not surface the forecast prominently.
 */
export function forecastMonthEnd(
  dailyTotals: DailyTotal[],
  currentDayOfMonth: number,
  daysInMonth: number,
  alpha: number = FORECAST_ALPHA,
): ForecastResult {
  if (dailyTotals.length === 0) {
    return {
      projectedMonthEnd: 0,
      dailyRate: 0,
      confidence: 'low',
      actualToDate: 0,
      remainingDays: daysInMonth - currentDayOfMonth,
      byCategory: [],
    };
  }

  const n = dailyTotals.length;
  const weights = dailyTotals.map((_, i) => Math.pow(alpha, n - 1 - i));
  const totalWeight = weights.reduce((s, w) => s + w, 0);

  const weightedDailyRate =
    dailyTotals.reduce((sum, day, i) => sum + day.amount * weights[i], 0) / totalWeight;

  const actualToDate = dailyTotals.reduce((s, d) => s + d.amount, 0);
  const remainingDays = Math.max(daysInMonth - currentDayOfMonth, 0);
  const projectedMonthEnd = actualToDate + weightedDailyRate * remainingDays;

  const confidence: ForecastResult['confidence'] =
    n >= 15 ? 'high' : n >= 7 ? 'medium' : 'low';

  return {
    projectedMonthEnd: round2(projectedMonthEnd),
    dailyRate: round2(weightedDailyRate),
    confidence,
    actualToDate: round2(actualToDate),
    remainingDays,
    byCategory: [],
  };
}

/**
 * Per-category forecast — runs the same WES algorithm per category.
 * Also determines status relative to budget.
 */
export function forecastByCategory(
  categoryDailyTotals: CategoryDailyTotal[],
  currentDayOfMonth: number,
  daysInMonth: number,
  budgets: Partial<Record<ExpenseCategory, number>>,
): CategoryForecast[] {
  const grouped = groupByCategory(categoryDailyTotals);

  return Object.entries(grouped).map(([category, dailyTotals]) => {
    const result = forecastMonthEnd(dailyTotals, currentDayOfMonth, daysInMonth);
    const budget = budgets[category as ExpenseCategory];

    let status: CategoryForecast['status'] = 'on_track';
    if (budget) {
      if (result.projectedMonthEnd > budget) {
        status = 'over';
      } else if (result.projectedMonthEnd > budget * FORECAST_AT_RISK_PCT) {
        status = 'at_risk';
      }
    }

    return {
      category: category as ExpenseCategory,
      actualToDate: result.actualToDate,
      projected: result.projectedMonthEnd,
      budget,
      status,
    };
  });
}

/**
 * Day-of-week spending multipliers — learns personal patterns.
 * Returns a map of day (0=Sun) → multiplier relative to weekly average.
 * e.g. { 5: 2.1 } means Fridays cost 2.1× the daily average.
 */
export function computeDayOfWeekMultipliers(
  dailyTotals: DailyTotal[],
): Record<number, number> {
  const byDay: Record<number, number[]> = {};

  dailyTotals.forEach(d => {
    const dow = new Date(d.date).getDay();
    if (!byDay[dow]) byDay[dow] = [];
    byDay[dow].push(d.amount);
  });

  const avgByDay: Record<number, number> = {};
  let totalDays = 0;
  let totalAmount = 0;

  for (const [dow, amounts] of Object.entries(byDay)) {
    const avg = amounts.reduce((s, a) => s + a, 0) / amounts.length;
    avgByDay[parseInt(dow)] = avg;
    totalDays++;
    totalAmount += avg;
  }

  const overallAvg = totalDays > 0 ? totalAmount / totalDays : 1;

  return Object.fromEntries(
    Object.entries(avgByDay).map(([dow, avg]) => [dow, avg / overallAvg])
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function groupByCategory(
  items: CategoryDailyTotal[],
): Record<string, DailyTotal[]> {
  const result: Record<string, DailyTotal[]> = {};
  items.forEach(item => {
    if (!result[item.category]) result[item.category] = [];
    result[item.category].push({ date: item.date, amount: item.amount });
  });
  return result;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
