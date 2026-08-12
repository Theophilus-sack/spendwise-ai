/**
 * Learns a user's own categorization habits from their expense history, so
 * they stop having to correct the same merchant over and over. Mirrors
 * packages/shared/src/categorization.ts's findMerchantCategoryOverride —
 * duplicated rather than imported because Deno edge functions can't pull
 * from the npm workspace (see other _shared/*.ts files for the same note).
 */

export interface CategoryHistoryEntry {
  merchant_name: string | null;
  description: string | null;
  category: string;
  date: string;
}

function normalizeKey(text: string): string {
  return text.trim().toLowerCase();
}

function keyFor(merchantName: string | null | undefined, description: string | null | undefined): string | undefined {
  if (merchantName && merchantName.trim()) return normalizeKey(merchantName);
  if (description && description.trim()) return normalizeKey(description);
  return undefined;
}

function candidateTexts(merchantName: string | null | undefined, description: string | null | undefined): string[] {
  const out: string[] = [];
  if (merchantName && merchantName.trim()) out.push(normalizeKey(merchantName));
  if (description && description.trim()) out.push(normalizeKey(description));
  return out;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Whole-word substring match in either direction, not strict equality — free
// text rarely repeats verbatim (e.g. an existing "Waakye" expense should
// still match a later "50 cedis on waakye today"). Word-boundary anchored so
// it doesn't false-positive the way a bare substring check would ("bar" must
// not match inside "barber"). 3-char floor on the shorter side avoids
// one/two-letter fragments matching almost anything; short exact matches
// still work via the equality check before the length floor applies.
function textsMatch(a: string, b: string): boolean {
  if (a === b) return true;
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  if (shorter.length < 3) return false;
  return new RegExp(`\\b${escapeRegExp(shorter)}\\b`, 'i').test(longer);
}

/**
 * Prior match on merchant/description in this user's own history — the
 * strongest signal available, since it's literally what they already
 * decided for the same merchant or item before. Most recent wins.
 */
export function findCategoryOverride(
  merchantName: string | undefined,
  description: string | undefined,
  history: CategoryHistoryEntry[],
): { category: string; confidence: number } | undefined {
  const queryTexts = candidateTexts(merchantName, description);
  if (queryTexts.length === 0) return undefined;

  const matches = history.filter((h) => {
    const historyTexts = candidateTexts(h.merchant_name, h.description);
    return historyTexts.some((ht) => queryTexts.some((qt) => textsMatch(qt, ht)));
  });
  if (matches.length === 0) return undefined;

  const mostRecent = matches.reduce((a, b) => (a.date > b.date ? a : b));
  return { category: mostRecent.category, confidence: 0.95 };
}

/**
 * A handful of the user's own (merchant → category) choices, formatted as
 * prompt lines — nudges Claude toward this user's categorization style for
 * merchants that don't exactly match anything in history (e.g. correcting
 * "Trustwash" to "shopping" should make "Trustclean" lean shopping too).
 * One line per distinct merchant/description key, most recent first.
 */
export function buildFewShotLines(history: CategoryHistoryEntry[], limit = 12): string[] {
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const h of [...history].sort((a, b) => (a.date < b.date ? 1 : -1))) {
    const key = keyFor(h.merchant_name, h.description);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    lines.push(`"${h.merchant_name ?? h.description}" → ${h.category}`);
    if (lines.length >= limit) break;
  }
  return lines;
}
