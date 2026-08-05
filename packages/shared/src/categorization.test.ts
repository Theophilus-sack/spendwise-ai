import { describe, test, expect } from 'bun:test';
import { categorizeLocally, parseExpenseLocally } from './categorization';

describe('categorizeLocally', () => {
  test('matches a known merchant with high confidence', () => {
    const result = categorizeLocally('lunch', 'KFC Accra Mall');
    expect(result.category).toBe('food');
    expect(result.confidence).toBeGreaterThan(0.8);
    expect(result.source).toBe('rule');
  });

  test('falls back to a keyword rule when no merchant matches', () => {
    const result = categorizeLocally('paid the electricity bill');
    expect(result.category).toBe('bills');
  });

  test('falls back to "other" with low confidence when nothing matches', () => {
    const result = categorizeLocally('xyz unrecognizable description qwerty');
    expect(result.category).toBe('other');
    expect(result.confidence).toBeLessThan(0.5);
  });

  // Regression coverage for the word-boundary bug: bare substring keyword
  // matches previously misclassified ordinary words that merely happen to
  // contain a keyword. Each case below asserts the category a naive
  // substring match would have wrongly produced is NOT what comes out.
  describe('word-boundary regression — real words containing a bare keyword', () => {
    test('"treat" does not trigger the "eat" food keyword', () => {
      const result = categorizeLocally("I'll treat myself later");
      expect(result.category).not.toBe('food');
    });

    test('"business" does not trigger the "bus" transport keyword', () => {
      const result = categorizeLocally('business lunch expense');
      // "lunch" legitimately matches food — the point is "bus" inside
      // "business" must not force this to transport instead.
      expect(result.category).not.toBe('transport');
    });

    test('"barber" does not trigger the "bar" entertainment keyword', () => {
      const result = categorizeLocally('haircut at the barber');
      expect(result.category).not.toBe('entertainment');
    });

    test('"current"/"parent"/"different" do not trigger the "rent" keyword', () => {
      expect(categorizeLocally('current account fee').category).not.toBe('rent');
      expect(categorizeLocally('gift for my parent').category).not.toBe('rent');
      expect(categorizeLocally('bought a different phone case').category).not.toBe('rent');
    });

    test('"watermelon" does not trigger the "water" bills keyword', () => {
      const result = categorizeLocally('bought watermelon at the market');
      expect(result.category).not.toBe('bills');
    });

    test('"refund" does not trigger the "fund" savings keyword', () => {
      const result = categorizeLocally('got a refund from Jumia');
      expect(result.category).not.toBe('savings');
    });

    test('"fundamentals" does not trigger the "fun" entertainment keyword', () => {
      const result = categorizeLocally('fundamentals of investing course');
      expect(result.category).not.toBe('entertainment');
    });

    test('the standalone keywords still match correctly on their own', () => {
      expect(categorizeLocally('paid rent for the apartment').category).toBe('rent');
      expect(categorizeLocally('took the bus to work').category).toBe('transport');
      expect(categorizeLocally('drinks at the bar').category).toBe('entertainment');
      expect(categorizeLocally('watered the plants, bought water').category).toBe('bills');
      expect(categorizeLocally('added money to my fund').category).toBe('savings');
    });
  });
});

describe('parseExpenseLocally', () => {
  test('extracts an amount and today\'s date by default', () => {
    const result = parseExpenseLocally('spent 80 on bolt', '2026-01-15');
    expect(result.amount).toBe(80);
    expect(result.date).toBe('2026-01-15');
    expect(result.category).toBe('transport');
  });

  test('shifts the date back a day when "yesterday" is mentioned', () => {
    const result = parseExpenseLocally('bought lunch yesterday, 45 cedis', '2026-01-15');
    expect(result.date).toBe('2026-01-14');
  });

  test('leaves amount undefined when no number is present', () => {
    const result = parseExpenseLocally('bought lunch at KFC', '2026-01-15');
    expect(result.amount).toBeUndefined();
  });
});
