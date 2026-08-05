import type { ExpenseCategory, CategorizationResult } from './types';

// ─── Merchant → Category map (Ghana-specific) ─────────────────────────────────

const MERCHANT_MAP: Record<string, ExpenseCategory> = {
  // Food
  'kfc': 'food', 'chicken republic': 'food', 'papaye': 'food',
  'pizza inn': 'food', 'dominos': 'food', 'burger king': 'food',
  'mcdonalds': 'food', 'mcfoodcourt': 'food', 'frankies': 'food',
  'buka': 'food', 'chop bar': 'food', 'canteen': 'food',
  // Transport
  'bolt': 'transport', 'uber': 'transport', 'yango': 'transport',
  'trotro': 'transport', 'metro mass': 'transport', 'vip': 'transport',
  'stc': 'transport', 'bus': 'transport', 'fuel': 'transport', 'petrol': 'transport',
  // Groceries
  'shoprite': 'groceries', 'melcom': 'groceries', 'market': 'groceries',
  'palace': 'groceries', 'maxmart': 'groceries', 'koala': 'groceries',
  'game': 'groceries', 'supasave': 'groceries',
  // Bills
  'mtn': 'bills', 'vodafone': 'bills', 'airtel': 'bills', 'airteltigo': 'bills',
  'dstv': 'bills', 'gotv': 'bills', 'startimes': 'bills',
  'electricity': 'bills', 'ecg': 'bills', 'gwcl': 'bills', 'water': 'bills',
  'netflix': 'bills', 'spotify': 'bills', 'youtube': 'bills',
  // Shopping
  'zara': 'shopping', 'h&m': 'shopping', 'uniqlo': 'shopping',
  'primark': 'shopping', 'accra mall': 'shopping', 'west hills': 'shopping',
  'junction mall': 'shopping', 'a&c mall': 'shopping',
  // Entertainment
  'silverbird': 'entertainment', 'palace cinema': 'entertainment',
  'cinema': 'entertainment', 'movie': 'entertainment', 'bar': 'entertainment',
  'club': 'entertainment', 'concert': 'entertainment',
  // Health
  'pharmacy': 'health', 'chemist': 'health', 'clinic': 'health',
  'hospital': 'health', 'medilab': 'health', 'trust hospital': 'health',
  // Education
  'university': 'education', 'school': 'education', 'college': 'education',
  'tuition': 'education', 'books': 'education', 'stationery': 'education',
};

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Precomputed once at module load, not per call — the merchant map is
// checked on every categorization, so building a fresh RegExp per entry
// per call would be wasteful. Word-boundary wrapped for the same reason as
// KEYWORD_RULES below: several merchant keys are generic English words
// ('water', 'bus', 'bar', 'game'), not just brand names, and were
// previously matched via a bare `input.includes(merchant)` — "watermelon"
// matched 'water', "barber" matched 'bar', etc.
const MERCHANT_RULES: Array<[RegExp, ExpenseCategory]> = Object.entries(MERCHANT_MAP).map(
  ([merchant, category]) => [new RegExp(`\\b${escapeRegExp(merchant)}\\b`, 'i'), category],
);

// Every alternative is wrapped in \b...\b — bare substrings previously
// misclassified real words that merely contain a keyword: "eat" matched
// inside "treat", "bus" inside "business", "bar" inside "barber", "rent"
// inside "current"/"parent", "water" inside "watermelon", "fund" inside
// "refund", "fun" inside "fundamentals". Word boundaries fix all of these
// while still matching the intended standalone word (multi-word phrases
// like "chop bar" still match correctly — \b anchors on the outer edges).
const KEYWORD_RULES: Array<[RegExp, ExpenseCategory]> = [
  [/\b(pharmacy|chemist|clinic|hospital|medical|health)\b/i, 'health'],
  [/\b(school|university|tuition|fees|college|lecture)\b/i, 'education'],
  [/\b(rent|landlord|apartment|housing)\b/i, 'rent'],
  [/\b(restaurant|food|chop bar|canteen|lunch|dinner|breakfast|snack|eat)\b/i, 'food'],
  [/\b(grocery|supermarket|market|shoprite|melcom)\b/i, 'groceries'],
  [/\b(electricity|water|internet|wifi|dstv|gotv|netflix|spotify|subscription)\b/i, 'bills'],
  [/\b(bolt|uber|yango|trotro|bus|taxi|transport|fuel|petrol|ride)\b/i, 'transport'],
  [/\b(cinema|movie|concert|club|bar|game|entertainment|fun)\b/i, 'entertainment'],
  [/\b(mall|shop|zara|clothes|fashion|shoes|boutique)\b/i, 'shopping'],
  [/\b(savings|save|invest|fund)\b/i, 'savings'],
];

/**
 * Local rule-based categorization — runs on-device with no API call.
 * Used as fallback when offline or when AI confidence < 0.70.
 */
export function categorizeLocally(
  description: string,
  merchantName?: string,
): CategorizationResult {
  const input = `${description} ${merchantName ?? ''}`.toLowerCase().trim();

  // Check merchant map first (high confidence)
  for (const [pattern, category] of MERCHANT_RULES) {
    if (pattern.test(input)) {
      return { category, confidence: 0.88, source: 'rule' };
    }
  }

  // Keyword rules (medium confidence)
  for (const [pattern, category] of KEYWORD_RULES) {
    if (pattern.test(input)) {
      return { category, confidence: 0.72, source: 'rule' };
    }
  }

  return { category: 'other', confidence: 0.40, source: 'rule' };
}

export const LOW_CONFIDENCE_THRESHOLD = 0.70;

// ─── Local NLP fallback ─────────────────────────────────────────────────────

export interface LocalExpenseParse {
  amount?: number;
  category: ExpenseCategory;
  description: string;
  date: string;
  confidence: number;
}

/**
 * Best-effort, fully offline fallback for Quick Add — used when the
 * AI-backed parse-nlp-expense function is unreachable (offline, or not yet
 * deployed). Extracts an amount via regex and a category via the same rule
 * engine categorizeLocally uses. It does not attempt merchant extraction,
 * which needs real language understanding to do reliably — the user fills
 * that in on the form after this pre-fills what it safely can.
 */
export function parseExpenseLocally(input: string, today: string): LocalExpenseParse {
  const amountMatch = input.match(/(\d+(?:\.\d{1,2})?)/);
  const amount = amountMatch ? parseFloat(amountMatch[1]) : undefined;

  const { category, confidence } = categorizeLocally(input);
  const date = /\byesterday\b/i.test(input) ? shiftDate(today, -1) : today;

  return { amount, category, description: input.trim(), date, confidence };
}

function shiftDate(iso: string, deltaDays: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + deltaDays);
  return d.toISOString().split('T')[0];
}
