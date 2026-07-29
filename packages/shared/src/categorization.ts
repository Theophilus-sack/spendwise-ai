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

const KEYWORD_RULES: Array<[RegExp, ExpenseCategory]> = [
  [/pharmacy|chemist|clinic|hospital|medical|health/i, 'health'],
  [/school|university|tuition|fees|college|lecture/i, 'education'],
  [/rent|landlord|apartment|housing/i, 'rent'],
  [/restaurant|food|chop bar|canteen|lunch|dinner|breakfast|snack|eat/i, 'food'],
  [/grocery|supermarket|market|shoprite|melcom/i, 'groceries'],
  [/electricity|water|internet|wifi|dstv|gotv|netflix|spotify|subscription/i, 'bills'],
  [/bolt|uber|yango|trotro|bus|taxi|transport|fuel|petrol|ride/i, 'transport'],
  [/cinema|movie|concert|club|bar|game|entertainment|fun/i, 'entertainment'],
  [/mall|shop|zara|clothes|fashion|shoes|boutique/i, 'shopping'],
  [/savings|save|invest|fund/i, 'savings'],
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
  for (const [merchant, category] of Object.entries(MERCHANT_MAP)) {
    if (input.includes(merchant)) {
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
