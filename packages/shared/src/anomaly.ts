import { ANOMALY_THRESHOLD, MIN_HISTORY_FOR_ANOMALY } from './constants';
import type { AnomalyResult } from './types';

/**
 * Iglewicz-Hoaglin Modified Z-Score anomaly detection.
 *
 * Uses Median Absolute Deviation (MAD) instead of standard deviation
 * because financial data is right-skewed — one large past purchase
 * inflates the mean, making standard Z-score less sensitive.
 *
 * Reference: Iglewicz & Hoaglin (1993), "How to Detect and Handle Outliers"
 * Recommended threshold: 3.5 (from the original paper)
 */
export function detectAnomaly(
  newAmount: number,
  historicalAmounts: number[],
  threshold: number = ANOMALY_THRESHOLD,
): AnomalyResult {
  if (historicalAmounts.length < MIN_HISTORY_FOR_ANOMALY) {
    return {
      isAnomaly: false,
      modifiedZScore: 0,
      median: 0,
      mad: 0,
      explanation: 'insufficient_history',
    };
  }

  const sorted = [...historicalAmounts].sort((a, b) => a - b);
  const median = computeMedian(sorted);

  const deviations = historicalAmounts.map(x => Math.abs(x - median));
  const mad = computeMedian([...deviations].sort((a, b) => a - b));

  if (mad === 0) {
    const isAnomaly = newAmount !== median;
    return {
      isAnomaly,
      modifiedZScore: isAnomaly ? 99 : 0,
      median,
      mad,
      explanation: isAnomaly ? 'deviation_from_constant_baseline' : 'normal',
    };
  }

  // Modified Z-score formula: M_i = 0.6745 * (x_i - median) / MAD
  const modifiedZScore = (0.6745 * (newAmount - median)) / mad;
  const isAnomaly = Math.abs(modifiedZScore) > threshold;

  return {
    isAnomaly,
    modifiedZScore: Math.round(modifiedZScore * 100) / 100,
    median: Math.round(median * 100) / 100,
    mad: Math.round(mad * 100) / 100,
    explanation: isAnomaly ? 'statistical_outlier' : 'normal',
  };
}

/**
 * Builds a spending heatmap: grid[dayOfWeek][hourOfDay] = avgAmount.
 * Used to visualise personal spending trigger patterns.
 * dayOfWeek: 0=Sunday … 6=Saturday
 * hourOfDay: 0–23
 */
export function buildSpendingHeatmap(
  expenses: Array<{ date: string; timeOfDay?: string; amount: number }>,
): number[][] {
  const grid = Array.from({ length: 7 }, () => Array(24).fill(0));
  const counts = Array.from({ length: 7 }, () => Array(24).fill(0));

  expenses.forEach(e => {
    if (!e.timeOfDay) return;
    const dow = new Date(e.date).getDay();
    const hour = parseInt(e.timeOfDay.split(':')[0], 10);
    if (hour < 0 || hour > 23) return;
    grid[dow][hour] += e.amount;
    counts[dow][hour] += 1;
  });

  return grid.map((row, d) =>
    row.map((total, h) => (counts[d][h] > 0 ? total / counts[d][h] : 0)),
  );
}

/**
 * Identifies peak risk windows from the heatmap.
 * Returns the top N (dow, hour) cells by average spend.
 */
export function findPeakRiskWindows(
  heatmap: number[][],
  topN = 3,
): Array<{ dayOfWeek: number; hourOfDay: number; avgAmount: number }> {
  const cells: Array<{ dayOfWeek: number; hourOfDay: number; avgAmount: number }> = [];

  heatmap.forEach((row, dow) => {
    row.forEach((avg, hour) => {
      if (avg > 0) cells.push({ dayOfWeek: dow, hourOfDay: hour, avgAmount: avg });
    });
  });

  return cells.sort((a, b) => b.avgAmount - a.avgAmount).slice(0, topN);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeMedian(sorted: number[]): number {
  const n = sorted.length;
  if (n === 0) return 0;
  const mid = Math.floor(n / 2);
  return n % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
