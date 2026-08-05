import { z } from 'zod';
import type {
  Expense, Budget, Debt, IncomeEntry, Goal, UserProfile,
  Currency, ExpenseCategory, PaymentMethod, MobileMoneyType,
} from '@spendwise/shared';
import type { NotificationItem } from '@/store/notificationStore';
import type { WeeklyReflection } from '@/store/weeklyReflectionStore';

// ─── Validated Supabase row → domain-object boundary ──────────────────────────
//
// Every store used to hand-map `Record<string, unknown>` rows into domain
// objects with `as any` scattered across every field — a renamed or
// type-changed remote column just silently became `undefined`/garbage
// instead of being caught. These schemas replace that: each one validates
// the raw row AND produces the final camelCase domain object in one step via
// `.transform()`, so a mismatch throws immediately with a clear message
// instead of propagating quietly into the UI.
//
// `satisfies z.ZodType<...>` on each enum is a compile-time tripwire: if
// packages/shared's union type ever gains/loses a member without this file
// being updated to match, that line stops compiling — the same
// shared-state-drift problem this whole file exists to solve, caught one
// level higher.

const currencySchema = z.enum(['GHS', 'USD', 'EUR', 'GBP', 'NGN', 'KES', 'ZAR', 'INR']) satisfies z.ZodType<Currency>;

const paymentMethodSchema = z.enum(['mobile_money', 'card', 'cash']) satisfies z.ZodType<PaymentMethod>;
const mobileMoneyTypeSchema = z.enum(['mtn_momo', 'vodafone_cash', 'airteltigo']) satisfies z.ZodType<MobileMoneyType>;

// ─── Rows are parsed one at a time, not as a batch ─────────────────────────────
//
// One malformed row (a bad migration, a half-written record) should not take
// down the entire list for a personal-finance app — that would be a worse
// regression than the silent `as any` it replaces. `parseRows` validates each
// row independently, drops (and loudly logs) only the ones that fail, and
// keeps every valid row. `parseRow` is for single-record fetches (e.g. the
// user's own profile) where the caller decides what "invalid" should mean.
export function parseRows<T>(schema: z.ZodType<T, z.ZodTypeDef, any>, rows: unknown[], label: string): T[] {
  const out: T[] = [];
  for (const row of rows) {
    const result = schema.safeParse(row);
    if (result.success) {
      out.push(result.data);
    } else {
      console.warn(`[schemas] Dropped an invalid "${label}" row:`, result.error.issues, row);
    }
  }
  return out;
}

export function parseRow<T>(schema: z.ZodType<T, z.ZodTypeDef, any>, row: unknown, label: string): T | null {
  const result = schema.safeParse(row);
  if (result.success) return result.data;
  console.warn(`[schemas] Invalid "${label}" row:`, result.error.issues, row);
  return null;
}

// ─── Expenses ───────────────────────────────────────────────────────────────

export const expenseRowSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  amount: z.coerce.number(),
  currency: currencySchema.nullish(),
  // Not a strict enum — this app deliberately supports free-text custom
  // categories (no DB constraint restricts it, and getCategoryEmoji/Label
  // both have explicit fallbacks for unrecognized values). An enum here
  // would silently drop every custom-category expense on reload.
  category: z.string().min(1),
  merchant_name: z.string().nullish(),
  payment_method: paymentMethodSchema,
  mobile_money_type: mobileMoneyTypeSchema.nullish(),
  description: z.string().nullish(),
  notes: z.string().nullish(),
  date: z.string(),
  time_of_day: z.string().nullish(),
  is_recurring: z.coerce.boolean(),
  is_split: z.coerce.boolean(),
  roundup_amount: z.coerce.number().nullish(),
  ai_categorized: z.coerce.boolean(),
  ai_confidence: z.coerce.number().nullish(),
  receipt_image_url: z.string().nullish(),
  created_at: z.string(),
  updated_at: z.string(),
}).transform((r): Expense => ({
  id: r.id, userId: r.user_id,
  amount: r.amount, currency: r.currency ?? 'GHS',
  category: r.category as ExpenseCategory, merchantName: r.merchant_name ?? undefined,
  paymentMethod: r.payment_method, mobileMoneyType: r.mobile_money_type ?? undefined,
  description: r.description ?? undefined, notes: r.notes ?? undefined,
  date: r.date, timeOfDay: r.time_of_day ?? undefined,
  isRecurring: r.is_recurring, isSplit: r.is_split,
  roundupAmount: r.roundup_amount ?? 0,
  aiCategorized: r.ai_categorized,
  aiConfidence: r.ai_confidence ?? undefined,
  receiptImageUrl: r.receipt_image_url ?? undefined,
  createdAt: r.created_at, updatedAt: r.updated_at,
}));

// ─── Budgets ────────────────────────────────────────────────────────────────

export const budgetRowSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  // Same reasoning as expenseRowSchema.category — custom categories are a
  // real, supported feature, not just the fixed built-in list.
  category: z.string().min(1),
  description: z.string().nullish(),
  limit_amount: z.coerce.number(),
  period: z.enum(['weekly', 'monthly', 'yearly']).nullish(),
  rollover: z.coerce.boolean(),
  ai_suggested: z.coerce.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
}).transform((r): Budget => ({
  id: r.id, userId: r.user_id,
  category: r.category as Budget['category'], description: r.description ?? undefined,
  limitAmount: r.limit_amount,
  period: r.period ?? 'monthly', rollover: r.rollover,
  aiSuggested: r.ai_suggested,
  createdAt: r.created_at, updatedAt: r.updated_at,
}));

// ─── Debts ──────────────────────────────────────────────────────────────────

export const debtRowSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  label: z.string(),
  debt_type: z.enum(['loan', 'credit_card', 'owed_to_me', 'i_owe']),
  principal_amount: z.coerce.number(),
  current_balance: z.coerce.number(),
  interest_rate_pct: z.coerce.number().nullish(),
  min_payment: z.coerce.number().nullish(),
  due_day_of_month: z.coerce.number().nullish(),
  lender_name: z.string().nullish(),
  start_date: z.string().nullish(),
  end_date: z.string().nullish(),
  status: z.enum(['active', 'paid']),
  notes: z.string().nullish(),
  created_at: z.string(),
  updated_at: z.string(),
}).transform((r): Debt => ({
  id: r.id, userId: r.user_id,
  label: r.label, debtType: r.debt_type,
  principalAmount: r.principal_amount, currentBalance: r.current_balance,
  interestRatePct: r.interest_rate_pct ?? 0,
  minPayment: r.min_payment ?? undefined,
  dueDayOfMonth: r.due_day_of_month ?? undefined,
  lenderName: r.lender_name ?? undefined,
  startDate: r.start_date ?? undefined,
  endDate: r.end_date ?? undefined,
  status: r.status,
  notes: r.notes ?? undefined,
  createdAt: r.created_at, updatedAt: r.updated_at,
}));

// ─── Income ─────────────────────────────────────────────────────────────────

export const incomeRowSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  source: z.enum(['salary', 'freelance', 'business', 'investments', 'allowance', 'other']),
  source_name: z.string().nullish(),
  amount: z.coerce.number(),
  currency: currencySchema.nullish(),
  date: z.string(),
  is_recurring: z.coerce.boolean(),
  interval: z.enum(['weekly', 'monthly', 'yearly']).nullish(),
  notes: z.string().nullish(),
  created_at: z.string(),
}).transform((r): IncomeEntry => ({
  id: r.id, userId: r.user_id,
  source: r.source, sourceName: r.source_name ?? undefined,
  amount: r.amount, currency: r.currency ?? 'GHS',
  date: r.date, isRecurring: r.is_recurring,
  interval: r.interval ?? undefined,
  notes: r.notes ?? undefined,
  createdAt: r.created_at,
}));

// ─── Goals ──────────────────────────────────────────────────────────────────

export const goalRowSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  title: z.string(),
  emoji: z.string().nullish(),
  target_amount: z.coerce.number(),
  current_amount: z.coerce.number().nullish(),
  deadline: z.string().nullish(),
  priority: z.coerce.number().nullish(),
  ai_weekly_target: z.coerce.number().nullish(),
  roundup_enabled: z.coerce.boolean(),
  status: z.enum(['active', 'completed', 'paused']).nullish(),
  created_at: z.string(),
  updated_at: z.string(),
}).transform((r): Goal => ({
  id: r.id, userId: r.user_id,
  title: r.title, emoji: r.emoji ?? '🎯',
  targetAmount: r.target_amount, currentAmount: r.current_amount ?? 0,
  deadline: r.deadline ?? undefined,
  priority: r.priority ?? 1,
  aiWeeklyTarget: r.ai_weekly_target ?? undefined,
  roundupEnabled: r.roundup_enabled,
  status: r.status ?? 'active',
  createdAt: r.created_at, updatedAt: r.updated_at,
}));

// ─── Notifications ──────────────────────────────────────────────────────────

export const notificationRowSchema = z.object({
  id: z.string(),
  type: z.string(),
  title: z.string(),
  body: z.string(),
  data: z.record(z.unknown()).nullish(),
  sent_at: z.string(),
  read_at: z.string().nullish(),
}).transform((r): NotificationItem => ({
  id: r.id, type: r.type, title: r.title, body: r.body,
  data: r.data ?? undefined,
  sentAt: r.sent_at, readAt: r.read_at ?? undefined,
}));

// ─── Weekly Reflections ─────────────────────────────────────────────────────

export const weeklyReflectionRowSchema = z.object({
  id: z.string(),
  week_start: z.string(),
  exceeded_category: z.string().nullish(),
  adjust_next_week: z.coerce.boolean(),
  small_change: z.string().nullish(),
  mood_rating: z.coerce.number().nullish(),
  ai_response: z.string().nullish(),
  follow_through: z.enum(['yes', 'partially', 'no']).nullish(),
  created_at: z.string(),
}).transform((r): WeeklyReflection => ({
  id: r.id,
  weekStart: r.week_start,
  exceededCategory: r.exceeded_category ?? null,
  adjustNextWeek: r.adjust_next_week,
  smallChange: r.small_change ?? '',
  moodRating: r.mood_rating ?? 3,
  aiResponse: r.ai_response ?? null,
  followThrough: r.follow_through ?? null,
  createdAt: r.created_at,
}));

// ─── Profile ────────────────────────────────────────────────────────────────

export const profileRowSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  full_name: z.string().nullish(),
  phone_number: z.string().nullish(),
  currency: currencySchema.nullish(),
  monthly_income: z.coerce.number().nullish(),
  income_sources: z.array(z.string()).nullish(),
  spending_personality: z.enum(['saver', 'balanced', 'spender']).nullish(),
  onboarding_goals: z.array(z.string()).nullish(),
  preferred_categories: z.array(z.string()).nullish(),
  preferred_payment_methods: z.array(z.string()).nullish(),
  savings_target_pct: z.coerce.number().nullish(),
  discipline_style: z.enum(['strict', 'flexible']).nullish(),
  onboarding_completed: z.coerce.boolean().nullish(),
  created_at: z.string(),
  updated_at: z.string(),
}).transform((r): UserProfile => ({
  id: r.id, userId: r.user_id,
  fullName: r.full_name ?? '',
  phoneNumber: r.phone_number ?? undefined,
  currency: r.currency ?? 'GHS',
  monthlyIncome: r.monthly_income ?? 0,
  incomeSources: (r.income_sources ?? []) as UserProfile['incomeSources'],
  spendingPersonality: r.spending_personality ?? undefined,
  financialGoals: r.onboarding_goals ?? [],
  preferredCategories: (r.preferred_categories ?? []) as UserProfile['preferredCategories'],
  preferredPaymentMethods: (r.preferred_payment_methods ?? []) as UserProfile['preferredPaymentMethods'],
  savingsTargetPct: r.savings_target_pct ?? 20,
  disciplineStyle: r.discipline_style ?? 'flexible',
  onboardingCompleted: r.onboarding_completed ?? false,
  createdAt: r.created_at, updatedAt: r.updated_at,
}));
