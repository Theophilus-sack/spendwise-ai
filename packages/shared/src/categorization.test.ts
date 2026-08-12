import { describe, test, expect } from 'bun:test';
import {
  categorizeLocally, parseExpenseLocally, parseExpensesLocally, findMerchantCategoryOverride,
} from './categorization';
import type { CategoryHistoryEntry } from './categorization';

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

describe('parseExpensesLocally', () => {
  test('splits a comma-separated input into one parsed expense per segment', () => {
    const results = parseExpensesLocally('coffee 20 cedis, lunch at papaye 45, uber 15', '2026-01-15');
    expect(results.length).toBe(3);
    expect(results.map(r => r.amount)).toEqual([20, 45, 15]);
    expect(results[2].category).toBe('transport');
  });

  test('splits on semicolons and newlines too', () => {
    const results = parseExpensesLocally('taxi 10; lunch 45\nrent 500', '2026-01-15');
    expect(results.map(r => r.amount)).toEqual([10, 45, 500]);
  });

  test('drops segments with no extractable amount instead of returning a zero-amount draft', () => {
    const results = parseExpensesLocally('coffee 20 cedis, bought lunch at KFC, uber 15', '2026-01-15');
    expect(results.map(r => r.amount)).toEqual([20, 15]);
  });

  test('a single-item input still returns exactly one expense', () => {
    const results = parseExpensesLocally('spent 80 on bolt', '2026-01-15');
    expect(results.length).toBe(1);
    expect(results[0].amount).toBe(80);
  });
});

describe('findMerchantCategoryOverride', () => {
  const history: CategoryHistoryEntry[] = [
    { merchantName: 'Trustwash', category: 'shopping', date: '2026-01-01' },
    { merchantName: 'Trustwash', category: 'other',    date: '2026-01-10' }, // most recent — should win
    { description: 'electricity bill', category: 'bills', date: '2026-01-05' },
  ];

  test('returns the most recent category for an exact merchant match', () => {
    const result = findMerchantCategoryOverride('Trustwash', undefined, history);
    expect(result?.category).toBe('other');
    expect(result?.confidence).toBeGreaterThan(0.9);
  });

  test('matches case-insensitively and ignores surrounding whitespace', () => {
    const result = findMerchantCategoryOverride('  trustwash  ', undefined, history);
    expect(result?.category).toBe('other');
  });

  test('falls back to description when no merchant is given, on either side', () => {
    const result = findMerchantCategoryOverride(undefined, 'Electricity Bill', history);
    expect(result?.category).toBe('bills');
  });

  test('returns undefined for a merchant never seen before', () => {
    const result = findMerchantCategoryOverride('Some New Shop', undefined, history);
    expect(result).toBeUndefined();
  });

  test('returns undefined when neither merchant nor description is provided', () => {
    const result = findMerchantCategoryOverride(undefined, undefined, history);
    expect(result).toBeUndefined();
  });

  describe('fuzzy matching regression — free text rarely repeats verbatim', () => {
    const foodHistory: CategoryHistoryEntry[] = [
      { merchantName: 'Waakye', category: 'food', date: '2026-01-01' },
    ];

    test('a later NLP-parsed description containing the same word still matches', () => {
      // The bug report this covers: "50 cedis on waakye today" didn't match
      // an existing "Waakye" expense because the two strings aren't equal.
      const result = findMerchantCategoryOverride(undefined, '50 cedis on waakye today', foodHistory);
      expect(result?.category).toBe('food');
    });

    test('matches regardless of which field (merchant vs description) held it originally', () => {
      const descHistory: CategoryHistoryEntry[] = [
        { description: 'waakye', category: 'food', date: '2026-01-01' },
      ];
      const result = findMerchantCategoryOverride('Waakye', undefined, descHistory);
      expect(result?.category).toBe('food');
    });

    test('word boundaries still prevent unrelated substring matches ("bar" must not match "barber")', () => {
      const barHistory: CategoryHistoryEntry[] = [
        { merchantName: 'bar', category: 'entertainment', date: '2026-01-01' },
      ];
      const result = findMerchantCategoryOverride(undefined, 'haircut at the barber', barHistory);
      expect(result).toBeUndefined();
    });

    test('very short fragments do not cause loose false-positive matches', () => {
      const result = findMerchantCategoryOverride(undefined, 'went to a shop today', history);
      expect(result).toBeUndefined();
    });
  });
});
