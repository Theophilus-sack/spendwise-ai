// Iglewicz-Hoaglin modified Z-score threshold — mirrors
// packages/shared/src/constants.ts's ANOMALY_THRESHOLD. Deno edge functions
// can't reach into the npm workspace at deploy time (same constraint
// documented in _shared/fds.ts), so this is a deliberate parallel copy, not
// an accidental one — kept in one place here instead of being redeclared per
// function the way it previously was.
export const ANOMALY_THRESHOLD = 3.5;
export const MIN_HISTORY_FOR_ANOMALY = 8;

export interface AnomalyResult {
  isAnomaly: boolean;
  modifiedZScore: number;
  median: number;
  mad: number;
  explanation: string;
}

/**
 * Iglewicz-Hoaglin Modified Z-Score anomaly detection — the single copy for
 * all edge functions. Uses Median Absolute Deviation (MAD) instead of
 * standard deviation because financial data is right-skewed.
 *
 * Mirrors packages/shared/src/anomaly.ts's detectAnomaly exactly, including
 * the MAD-zero sentinel case: when every historical amount is identical
 * (mad === 0), a new amount that differs from that constant baseline is
 * still flagged (score pinned to 99) rather than being silently waved
 * through — the previous per-function reimplementation here returned
 * isAnomaly:false unconditionally on mad === 0, missing that case.
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

function computeMedian(sorted: number[]): number {
  const n = sorted.length;
  if (n === 0) return 0;
  const mid = Math.floor(n / 2);
  return n % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
