import { describe, test, expect } from 'bun:test';
import { detectAnomaly } from './anomaly';

describe('detectAnomaly', () => {
  test('flags nothing with fewer than MIN_HISTORY_FOR_ANOMALY data points', () => {
    const result = detectAnomaly(1000, [10, 12, 11, 9, 13, 10, 11]); // 7 points
    expect(result.isAnomaly).toBe(false);
    expect(result.explanation).toBe('insufficient_history');
  });

  test('does not flag a normal amount close to the median', () => {
    const history = [50, 52, 48, 51, 49, 50, 53, 47, 50];
    const result = detectAnomaly(51, history);
    expect(result.isAnomaly).toBe(false);
  });

  test('flags a genuine statistical outlier via the modified Z-score', () => {
    const history = [50, 52, 48, 51, 49, 50, 53, 47, 50];
    const result = detectAnomaly(500, history);
    expect(result.isAnomaly).toBe(true);
    expect(result.explanation).toBe('statistical_outlier');
    expect(Math.abs(result.modifiedZScore)).toBeGreaterThan(3.5);
  });

  // MAD (median absolute deviation) is 0 whenever every historical amount is
  // identical — the modified Z-score formula divides by MAD, so this must be
  // special-cased rather than producing Infinity/NaN. The edge function's
  // independent reimplementation of this logic previously got this case
  // wrong (silently returned isAnomaly:false unconditionally); this locks in
  // the correct, shared behavior so that regression can't recur unnoticed.
  describe('MAD-zero sentinel behavior (constant historical baseline)', () => {
    const constantHistory = [100, 100, 100, 100, 100, 100, 100, 100];

    test('an amount matching the constant baseline exactly is NOT an anomaly', () => {
      const result = detectAnomaly(100, constantHistory);
      expect(result.isAnomaly).toBe(false);
      expect(result.modifiedZScore).toBe(0);
      expect(result.explanation).toBe('normal');
    });

    test('any amount that deviates from a constant baseline IS flagged, even a small deviation', () => {
      const result = detectAnomaly(105, constantHistory);
      expect(result.isAnomaly).toBe(true);
      expect(result.modifiedZScore).toBe(99);
      expect(result.explanation).toBe('deviation_from_constant_baseline');
    });

    test('a deviation below the baseline is also flagged, not just above', () => {
      const result = detectAnomaly(90, constantHistory);
      expect(result.isAnomaly).toBe(true);
      expect(result.explanation).toBe('deviation_from_constant_baseline');
    });

    test('never returns NaN or Infinity regardless of direction', () => {
      for (const amount of [0, 50, 100, 150, 1000]) {
        const result = detectAnomaly(amount, constantHistory);
        expect(Number.isFinite(result.modifiedZScore)).toBe(true);
        expect(Number.isFinite(result.median)).toBe(true);
        expect(Number.isFinite(result.mad)).toBe(true);
      }
    });
  });

  test('respects a custom threshold override', () => {
    const history = [50, 52, 48, 51, 49, 50, 53, 47, 50];
    // modifiedZScore here is ~13.5 — trips the default 3.5 threshold but not
    // a much looser custom one.
    const looseResult = detectAnomaly(70, history, 20);
    expect(looseResult.isAnomaly).toBe(false);
  });
});
