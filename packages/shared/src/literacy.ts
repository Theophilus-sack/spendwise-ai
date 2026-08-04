import type { SpendingPersonality, FDSComponents } from './types';

export type LiteracyCategory = 'budgeting' | 'saving' | 'debt' | 'mobile_money' | 'mindset' | 'score';

export const LITERACY_CATEGORIES: Record<LiteracyCategory, { label: string; emoji: string }> = {
  budgeting:    { label: 'Budgeting',    emoji: '📋' },
  saving:       { label: 'Saving',       emoji: '💰' },
  debt:         { label: 'Debt',         emoji: '🏦' },
  mobile_money: { label: 'Mobile Money', emoji: '📱' },
  mindset:      { label: 'Mindset',      emoji: '🧠' },
  score:        { label: 'Your Score',   emoji: '🛡️' },
};

export interface LiteracyArticle {
  id: string;
  title: string;
  category: LiteracyCategory;
  emoji: string;
  readMinutes: number;
  summary: string;
  body: string[];
  /** What this article is recommended for — used to personalize the "For you"
   *  shelf rather than showing the same generic top picks to every user. */
  relevantFor?: {
    personalities?: SpendingPersonality[];
    weakComponents?: Array<keyof FDSComponents>;
  };
}

export const LITERACY_ARTICLES: LiteracyArticle[] = [
  {
    id: 'fifty-thirty-twenty',
    title: "The 50/30/20 Rule, Adapted for Variable Income",
    category: 'budgeting',
    emoji: '📋',
    readMinutes: 4,
    summary: "The classic split (50% needs, 30% wants, 20% savings) assumes a fixed paycheck. Here's how to use it when your income actually moves month to month.",
    body: [
      "The 50/30/20 rule says: 50% of income to needs (rent, food, transport, bills), 30% to wants, and 20% to savings. It's a starting ratio, not a law — but it's a genuinely useful default when you have no better number to start from.",
      "The problem for a lot of people is that income isn't fixed. If you're on commission, freelance, or run a small business, applying 50/30/20 to a single month can be misleading — a slow month makes your 'needs' spending look reckless even when it's just fixed costs against lower income.",
      "The fix: apply the ratio to your trailing 3-month average income, not this month's number alone. Your needs spending should track that average, not swing with every good or bad month.",
      "In this app, your starter budget was built the same way — but against your declared savings %, not a fixed 20%. If your income changes, open Income and edit your monthly figure; you'll be offered a recalculation that keeps the same logic, using your actual savings goal instead of a generic default.",
    ],
    relevantFor: { weakComponents: ['budgetAdherence'] },
  },
  {
    id: 'zero-based-budgeting',
    title: 'Zero-Based Budgeting in Practice',
    category: 'budgeting',
    emoji: '🧮',
    readMinutes: 3,
    summary: "Every cedi gets a job before the month starts — including savings. Not stricter than a normal budget, just more honest about where the money is actually going.",
    body: [
      "Zero-based budgeting means: income minus every planned category (including savings) equals zero. Not 'spend whatever's left after bills' — every cedi is assigned a category in advance, savings included.",
      "The advantage over a loose budget is that it forces savings to be a line item, not an afterthought. Most people who say 'I'll save what's left at the end of the month' end up saving nothing, because there's rarely anything left.",
      "You don't need a spreadsheet for this — it's exactly what a full set of category budgets does. If every category you spend in has a limit, and those limits (plus savings) add up to your income, you're already doing zero-based budgeting.",
      "Check your Budget screen: if the 'budgeted % of income' figure at the bottom is well under 100%, some of your income has no job yet — which usually means it quietly becomes discretionary spending instead of a decision.",
    ],
    relevantFor: { weakComponents: ['budgetAdherence'] },
  },
  {
    id: 'pay-yourself-first',
    title: "Why 'Pay Yourself First' Actually Works",
    category: 'saving',
    emoji: '💵',
    readMinutes: 3,
    summary: "Saving what's left over rarely works. Saving first, then spending what's left, almost always does — and the reason is more about psychology than math.",
    body: [
      "'Pay yourself first' means moving your savings amount the moment income arrives — before any spending happens — rather than hoping there's something left at the end of the month.",
      "The reason this outperforms 'save the leftovers' isn't complicated math, it's behavior: money that's still sitting in a spendable account tends to get spent, gradually, on things that each felt reasonable in the moment. Money that's already moved out of reach doesn't face that test.",
      "This is exactly why this app asked for a savings percentage during onboarding instead of just tracking whatever you happen to have left. Treating savings as the first budget line, not the last, is the single highest-leverage habit change in personal finance.",
      "If your savings rate on the Discipline Score screen is consistently your weakest component, the fix usually isn't spending less everywhere a little — it's moving the savings amount out on day one, before it has a chance to compete with anything else.",
    ],
    relevantFor: { weakComponents: ['savingsRate'], personalities: ['spender'] },
  },
  {
    id: 'emergency-fund-irregular-income',
    title: 'Building an Emergency Fund When Income Is Irregular',
    category: 'saving',
    emoji: '🧯',
    readMinutes: 4,
    summary: "The standard advice is '3-6 months of expenses.' Here's a more realistic on-ramp if your income doesn't arrive in predictable monthly chunks.",
    body: [
      "An emergency fund's job is narrow and specific: covering a real, unplanned shock (medical bill, job gap, urgent repair) without going into debt for it. It is not a general savings goal — that's what a separate Goal is for.",
      "'3-6 months of expenses' is a good destination but a bad starting instruction — it's too large a number to start with, and abandoning the whole idea after one missed month is the actual risk.",
      "A more realistic on-ramp: target one month of your essential (needs-only) spending first. That's a concrete, reachable number, and it already covers the most common shocks. Only after that's in place does extending toward 3-6 months make sense.",
      "Keep it in a separate goal, not blended into your main balance — the whole point is that you don't 'accidentally' spend it because it looked available. Use the Goals screen with round-up or a fixed weekly contribution so it grows without a monthly decision.",
    ],
    relevantFor: { weakComponents: ['savingsRate'] },
  },
  {
    id: 'avalanche-vs-snowball',
    title: 'Avalanche vs Snowball: Which Payoff Method Fits You',
    category: 'debt',
    emoji: '⚖️',
    readMinutes: 4,
    summary: "One method saves you more money. The other keeps you motivated. They're not the same method, and picking the wrong one for your personality is why plans fail.",
    body: [
      "Debt avalanche: pay minimums on everything, throw every extra cedi at the debt with the highest interest rate first. This is mathematically optimal — it minimizes total interest paid, full stop.",
      "Debt snowball: pay minimums on everything, throw every extra cedi at the smallest balance first, regardless of interest rate. This is not mathematically optimal — but it produces a fully paid-off debt faster, which is a real psychological win that keeps people going.",
      "The honest answer to 'which is better' is: avalanche if you're confident you'll stay disciplined without early wins: snowball if you know from experience that you need visible progress to keep momentum. Neither is the 'smart' one and the other the 'dumb' one — they're optimized for different failure modes.",
      "Look at your debts in Debts & Loans: if you have several small balances, snowball will clear some of them off your list within weeks, which is worth something real even if it costs a bit more in interest overall.",
    ],
    relevantFor: { personalities: ['saver', 'balanced'] },
  },
  {
    id: 'minimum-payments-real-cost',
    title: 'The Real Cost of Minimum Payments',
    category: 'debt',
    emoji: '📉',
    readMinutes: 3,
    summary: "A minimum payment is designed to keep a balance alive for as long as possible, not to pay it off. Here's what that actually costs over time.",
    body: [
      "Minimum payments on credit cards and many loans are calculated to be just enough to cover that period's interest plus a small sliver of principal. This isn't an accident — a balance paid only at the minimum can take years longer to clear than the loan term suggests, with total interest sometimes exceeding the original amount borrowed.",
      "The practical fix isn't complicated: any amount above the minimum goes almost entirely toward principal, since the interest portion is already covered. Even a small consistent overpayment meaningfully shortens the payoff timeline.",
      "This app's Bill Calendar shows minimum payments specifically so they don't get mistaken for 'the plan' — they're the floor, not the target. If a due date shows only the minimum, treat that as the deadline for the smallest acceptable payment, not the payment itself.",
    ],
    relevantFor: { weakComponents: ['budgetAdherence'] },
  },
  {
    id: 'mobile-money-fees-add-up',
    title: 'How Small Mobile Money Fees Add Up',
    category: 'mobile_money',
    emoji: '📲',
    readMinutes: 3,
    summary: "A 1% transfer fee feels negligible on any single transaction. On your actual transaction volume over a year, it's rarely negligible.",
    body: [
      "Mobile money transfer and withdrawal fees are usually a small percentage or flat charge per transaction — easy to ignore because no single instance feels significant.",
      "The issue is frequency, not size: someone making several mobile money transactions a week can lose a meaningful sum over a year to fees alone, without any single transaction ever feeling like 'a lot.'",
      "This is exactly why this app tracks payment method on every expense — not to judge how you pay, but so the Analytics screen can show you the real total moving through mobile money versus cash versus card, where fee exposure is genuinely different.",
      "A practical habit: batch smaller planned transfers into fewer, larger ones where possible, and check your provider's fee tiers — many have a lower percentage rate above certain thresholds.",
    ],
    relevantFor: { personalities: ['spender'] },
  },
  {
    id: 'momo-impulse-trap',
    title: 'Impulse Transfers: The Mobile-Money-Specific Trap',
    category: 'mobile_money',
    emoji: '⚡',
    readMinutes: 3,
    summary: "Cash has friction built in. A mobile money transfer takes seconds and no physical trace — which makes it uniquely easy to spend without registering it as spending.",
    body: [
      "Physical cash has a built-in speed bump: you have to have it on you, hand it over, watch it leave your possession. Mobile money removes every bit of that friction — a transfer completes in seconds, from wherever you are, without the physical sensation of money leaving.",
      "This isn't a reason to avoid mobile money (it's not going anywhere, and it's genuinely more convenient) — it's a reason to be specific about where the missing friction gets replaced.",
      "One concrete replacement: before any transfer over a threshold you set for yourself, require a second, separate action — re-opening the app 10 minutes later to confirm, rather than sending in the same motion as deciding. That reintroduces just enough friction to catch genuinely impulsive transfers without slowing down routine ones.",
      "If your Discipline Score's consistency component is low specifically around certain times of day, that's often this exact pattern — check your Analytics heatmap for a spending-time cluster before assuming it's a budget problem rather than a friction problem.",
    ],
    relevantFor: { weakComponents: ['consistency'], personalities: ['spender'] },
  },
  {
    id: 'needs-vs-wants-practical-test',
    title: 'Needs vs Wants: A Practical Test, Not a Guilt Trip',
    category: 'mindset',
    emoji: '🔍',
    readMinutes: 3,
    summary: "The needs-vs-wants distinction gets moralized a lot. Used practically, it's just a sorting question that makes budgeting decisions faster, not a judgment about what you buy.",
    body: [
      "A need is something whose absence creates a real problem: rent unpaid means eviction risk, food unbought means going hungry. A want makes life better but its absence doesn't create a crisis.",
      "This sorting isn't about denying wants — a budget with zero 'wants' spending rarely survives contact with real life. It's about making sure needs are covered and accounted for before wants compete for the same cedis.",
      "A useful practical test: 'if my income dropped 30% next month, would this still get paid?' If yes, it's a need. If you'd cut it, it's a want — which is fine, it just belongs in the 'wants' portion of the budget, sized deliberately rather than left open-ended.",
      "The category grid in Add Expense is a rough proxy for this (rent and bills lean needs; entertainment and shopping lean wants) — but the real test is the question above, applied to your specific situation, not the category label alone.",
    ],
  },
  {
    id: 'willpower-vs-systems',
    title: "Why Willpower Alone Doesn't Work (and What Does)",
    category: 'mindset',
    emoji: '🧠',
    readMinutes: 4,
    summary: "Relying on willpower to not overspend fails for the same reason relying on willpower to not check your phone fails: willpower is a limited, fluctuating resource, not a fixed trait.",
    body: [
      "Willpower depletes over the course of a day and varies with stress, sleep, and mood — which is why the same person can resist an impulse purchase easily on a good day and cave to an identical one on a hard day. That's not a character flaw, it's how willpower actually works.",
      "Behavioral science's answer to this isn't 'try harder' — it's changing the environment so the disciplined choice doesn't require willpower in the moment. Auto-transferring savings on payday, removing saved card details from shopping apps, or setting a budget alert before you're already at the till are all examples of designing around willpower rather than relying on it.",
      "This is also the reasoning behind this app's Weekly Reflection: deciding your plan for next week in a calm, reflective moment (not in the heat of a purchase decision) and writing it down measurably increases the odds you follow through — a well-documented effect called an 'implementation intention.'",
      "If you've set a plan in Weekly Reflection before, the follow-through question the next week isn't there to guilt-trip you — it's there because naming the plan out loud, even briefly, is most of what makes it more likely to happen.",
    ],
    relevantFor: { weakComponents: ['consistency', 'improvement'] },
  },
  {
    id: 'how-fds-works',
    title: 'How Your Financial Discipline Score Actually Works',
    category: 'score',
    emoji: '🛡️',
    readMinutes: 4,
    summary: "Not a black box: your score is four weighted, visible components plus a small bonus for reflecting. Here's exactly what moves it and by how much.",
    body: [
      "Your Discipline Score out of 100 is built from four components: Budget Adherence (35%) — the share of your budget categories you stayed under; Savings Rate (30%) — actual savings against your target; Consistency (20%) — how many days that week you logged an expense; and Improvement (15%) — whether this week trended up or down against last week.",
      "Those weights aren't arbitrary decoration — they reflect that staying within budget and actually saving matter more to real financial health than perfect daily logging, though logging still counts because it's the input everything else depends on.",
      "The score is also smoothed: 70% this week's calculation, 30% last week's stored score. That's deliberate — one unusually good or bad week shouldn't swing your score wildly, since financial discipline is a pattern, not a single data point.",
      "Completing a Weekly Reflection adds a small flat bonus on top. It's kept separate from the four weighted components on purpose — reflecting on your week is genuinely valuable, but reweighting the core formula to include it would quietly change what every past score meant.",
    ],
  },
  {
    id: 'what-consistency-means',
    title: "What 'Consistency' Means for Your Score, and Why It's 20%",
    category: 'score',
    emoji: '📅',
    readMinutes: 3,
    summary: "Consistency isn't about spending less — it's about logging regularly. Here's why that specific behavior earns its own 20% weight.",
    body: [
      "The Consistency component measures something narrow and specific: how many of the last 7 days had at least one logged expense. It says nothing about how much you spent — a heavy-spending day and a light-spending day both count equally, as long as it was logged.",
      "This is intentional. Every other component (Budget Adherence, Savings Rate, Improvement) depends on having accurate data to calculate from. A week with three days unlogged isn't a disciplined week that happens to look sparse — it's a week the app genuinely can't evaluate properly, which understates your other numbers too.",
      "In practice, the fastest way to move a stuck Discipline Score usually isn't a dramatic spending cutback — it's closing the gap between what you actually spend and what gets logged. A perfectly accurate 'bad' week scores more honestly, and often better, than a well-behaved week with gaps in it.",
      "If Consistency is your lowest component, Quick Add on the Dashboard is built for exactly this — logging a rough amount in seconds is more valuable to your score than a perfectly detailed entry you never get around to.",
    ],
    relevantFor: { weakComponents: ['consistency'] },
  },
];

export function getArticleById(id: string): LiteracyArticle | undefined {
  return LITERACY_ARTICLES.find(a => a.id === id);
}

/**
 * Picks a small, genuinely personalized shelf rather than a static "editor's
 * picks" list — ranks by how many of the user's actual signals (spending
 * personality, weakest FDS component) an article matches, so two users see
 * different recommendations.
 */
export function recommendArticles(
  personality: SpendingPersonality | undefined,
  weakComponent: keyof FDSComponents | undefined,
  limit = 3,
): LiteracyArticle[] {
  const scored = LITERACY_ARTICLES.map(article => {
    let score = 0;
    if (personality && article.relevantFor?.personalities?.includes(personality)) score += 1;
    if (weakComponent && article.relevantFor?.weakComponents?.includes(weakComponent)) score += 2;
    return { article, score };
  });
  const matched = scored.filter(s => s.score > 0).sort((a, b) => b.score - a.score);
  const rest = scored.filter(s => s.score === 0);
  return [...matched, ...rest].slice(0, limit).map(s => s.article);
}
