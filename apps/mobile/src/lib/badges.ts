import { startOfMonthISO } from '@spendwise/shared';
import type { Expense, Goal, Budget, IncomeEntry, BadgeId } from '@spendwise/shared';

export interface BadgeEvalInput {
  expenses: Expense[];
  goals: Goal[];
  budgets: Budget[];
  incomeEntries: IncomeEntry[];
  monthlyIncome: number;
  disciplineGrade: 'A' | 'B' | 'C' | 'D' | 'F' | null;
  hasAiConversation: boolean;
  hasDebtPayment: boolean;
}

/**
 * Evaluates every badge against the user's real, currently-loaded data.
 * `analyzer` always resolves false — there's no usage-tracking for the
 * Analytics screen yet, so an honest "locked" is correct rather than
 * fabricating a signal for it.
 */
export function evaluateBadges(input: BadgeEvalInput): Record<BadgeId, boolean> {
  const {
    expenses, goals, budgets, incomeEntries, monthlyIncome,
    disciplineGrade, hasAiConversation, hasDebtPayment,
  } = input;

  const monthStart = startOfMonthISO();
  const thisMonthExpenses = expenses.filter(e => e.date >= monthStart);
  const loggedDates = Array.from(new Set(expenses.map(e => e.date))).sort();
  const streak = computeLoggingStreak(loggedDates);

  const spentByCategory = thisMonthExpenses.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] ?? 0) + e.amount;
    return acc;
  }, {});
  const anyBudgetOverThisMonth = budgets.some(b => (spentByCategory[b.category] ?? 0) > b.limitAmount);

  const totalSpentThisMonth = thisMonthExpenses.reduce((s, e) => s + e.amount, 0);
  const totalIncomeThisMonth =
    monthlyIncome + incomeEntries.filter(e => e.date >= monthStart).reduce((s, e) => s + e.amount, 0);

  return {
    first_expense:   expenses.length > 0,
    first_income:    monthlyIncome > 0 || incomeEntries.length > 0,
    first_budget:    budgets.length > 0,
    streak_3:        streak >= 3,
    streak_7:        streak >= 7,
    streak_30:       streak >= 30,
    streak_100:      streak >= 100,
    budget_kept:     budgets.length > 0 && !anyBudgetOverThisMonth,
    saver:           totalIncomeThisMonth > 0 && totalSpentThisMonth < totalIncomeThisMonth,
    goal_setter:     goals.length > 0,
    goal_halfway:    goals.some(g => g.targetAmount > 0 && g.currentAmount / g.targetAmount >= 0.5),
    goal_crusher:    goals.some(g => g.status === 'completed' || (g.targetAmount > 0 && g.currentAmount >= g.targetAmount)),
    debt_slayer:     hasDebtPayment,
    discipline_a:    disciplineGrade === 'A',
    no_spend_day:    hasNoSpendDayThisMonth(loggedDates),
    early_bird:      expenses.some(e => !!e.timeOfDay && e.timeOfDay < '08:00'),
    analyzer:        false,
    receipt_scanner: expenses.some(e => !!e.receiptImageUrl),
    ai_user:         hasAiConversation,
    month_master:    streak >= 30,
  };
}

/** Consecutive days with at least one logged expense, counting back from today
 *  (or yesterday, so the streak doesn't reset the instant a new day begins
 *  before today's first entry is logged). */
function computeLoggingStreak(sortedDates: string[]): number {
  if (sortedDates.length === 0) return 0;
  const dateSet = new Set(sortedDates);
  const today = new Date();

  let cursor = dateSet.has(toISO(today)) ? today : addDays(today, -1);
  if (!dateSet.has(toISO(cursor))) return 0;

  let streak = 0;
  while (dateSet.has(toISO(cursor))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/** True if there's a day this month, after tracking began, with zero logged spend. */
function hasNoSpendDayThisMonth(allLoggedDatesSorted: string[]): boolean {
  if (allLoggedDatesSorted.length < 3) return false;

  const trackingStart = allLoggedDatesSorted[0];
  const monthStart = startOfMonthISO();
  const rangeStart = trackingStart > monthStart ? trackingStart : monthStart;
  const spentDates = new Set(allLoggedDatesSorted);

  const cursor = new Date(`${rangeStart}T00:00:00`);
  const todayIso = toISO(new Date());
  while (toISO(cursor) < todayIso) {
    if (!spentDates.has(toISO(cursor))) return true;
    cursor.setDate(cursor.getDate() + 1);
  }
  return false;
}

function addDays(date: Date, delta: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + delta);
  return d;
}

function toISO(date: Date): string {
  return date.toISOString().split('T')[0];
}
