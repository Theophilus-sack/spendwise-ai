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

// ─── Learned merchant overrides ─────────────────────────────────────────────

export interface CategoryHistoryEntry {
  merchantName?: string;
  description?: string;
  category: ExpenseCategory;
  date: string;
}

function normalizeKey(text: string): string {
  return text.trim().toLowerCase();
}

function candidateTexts(merchantName: string | undefined, description: string | undefined): string[] {
  const out: string[] = [];
  if (merchantName && merchantName.trim()) out.push(normalizeKey(merchantName));
  if (description && description.trim()) out.push(normalizeKey(description));
  return out;
}

// Whole-word substring match in either direction — a strict equality check
// missed real cases like a history entry "Waakye" not matching a later "50
// cedis on waakye today" (extra words break exact equality even though it's
// obviously the same thing). Word-boundary anchored so it doesn't do what
// the old bare-substring merchant matching bug used to (see MERCHANT_RULES
// above): "bar" must not match inside "barber". A 3-character floor on the
// shorter side avoids one-letter/two-letter fragments ("at", "on") matching
// almost anything; exact equality below that floor still matches via the
// short-circuit before the length check runs.
function textsMatch(a: string, b: string): boolean {
  if (a === b) return true;
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  if (shorter.length < 3) return false;
  return new RegExp(`\\b${escapeRegExp(shorter)}\\b`, 'i').test(longer);
}

/**
 * Prior match on merchant/description in the user's own expense history —
 * the strongest signal available, since it's literally what this user
 * already decided for the same merchant or item before. Matches on either
 * field, in either direction, as a whole-word substring rather than requiring
 * an exact string — free-text entries rarely repeat verbatim. Most recent
 * match wins, so a later correction overrides an earlier one. Runs entirely
 * on-device against already-cached expenses, so it works offline and needs
 * no extra network round trip.
 */
export function findMerchantCategoryOverride(
  merchantName: string | undefined,
  description: string | undefined,
  history: CategoryHistoryEntry[],
): { category: ExpenseCategory; confidence: number } | undefined {
  const queryTexts = candidateTexts(merchantName, description);
  if (queryTexts.length === 0) return undefined;

  const matches = history.filter((h) => {
    const historyTexts = candidateTexts(h.merchantName, h.description);
    return historyTexts.some((ht) => queryTexts.some((qt) => textsMatch(qt, ht)));
  });
  if (matches.length === 0) return undefined;

  const mostRecent = matches.reduce((a, b) => (a.date > b.date ? a : b));
  return { category: mostRecent.category, confidence: 0.95 };
}

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

/**
 * Multi-item counterpart to parseExpenseLocally, used as the offline fallback
 * for batch Quick Add / voice input. Splits on commas/semicolons/newlines —
 * the same separators the cloud parser's prompt is told to expect — and runs
 * the single-item parser per segment. Segments with no extractable amount are
 * dropped rather than surfaced as a zero-amount draft the user would just
 * have to discard.
 */
export function parseExpensesLocally(input: string, today: string): LocalExpenseParse[] {
  return input
    .split(/[,;\n]+/)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)
    .map((segment) => parseExpenseLocally(segment, today))
    .filter((parsed) => parsed.amount !== undefined);
}

function shiftDate(iso: string, deltaDays: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + deltaDays);
  return d.toISOString().split('T')[0];
}
