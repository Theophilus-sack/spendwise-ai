// ─── Core Domain Types ───────────────────────────────────────────────────────

export type Currency = 'GHS' | 'USD' | 'EUR' | 'GBP' | 'NGN' | 'KES' | 'ZAR' | 'INR';

export type PaymentMethod = 'mobile_money' | 'card' | 'cash';

export type MobileMoneyType = 'mtn_momo' | 'vodafone_cash' | 'airteltigo';

export type ExpenseCategory =
  | 'food'
  | 'transport'
  | 'groceries'
  | 'bills'
  | 'shopping'
  | 'entertainment'
  | 'health'
  | 'education'
  | 'rent'
  | 'savings'
  | 'other';

export type BudgetPeriod = 'weekly' | 'monthly' | 'yearly';

export type IncomeSource =
  | 'salary'
  | 'freelance'
  | 'business'
  | 'investments'
  | 'allowance'
  | 'other';

export type DebtType = 'loan' | 'credit_card' | 'owed_to_me' | 'i_owe';

export type SpendingPersonality = 'saver' | 'balanced' | 'spender';

export type DisciplineStyle = 'strict' | 'flexible';

// ─── User Profile ─────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  userId: string;
  fullName: string;
  phoneNumber?: string;
  currency: Currency;
  monthlyIncome: number;
  incomeSources: IncomeSource[];
  spendingPersonality?: SpendingPersonality;
  financialGoals: string[];
  preferredCategories: ExpenseCategory[];
  preferredPaymentMethods: PaymentMethod[];
  savingsTargetPct: number;
  disciplineStyle: DisciplineStyle;
  onboardingCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OnboardingData {
  currency: Currency;
  incomeRange: string;
  incomeSources: IncomeSource[];
  spendingPersonality: SpendingPersonality;
  savingsFrequency: 'regular' | 'occasional' | 'none';
  financialGoals: string[];
  preferredCategories: ExpenseCategory[];
  preferredPaymentMethods: PaymentMethod[];
  disciplineStyle: DisciplineStyle;
}

// ─── Expenses ─────────────────────────────────────────────────────────────────

export interface Expense {
  id: string;
  userId: string;
  amount: number;
  currency: Currency;
  category: ExpenseCategory;
  subcategory?: string;
  merchantName?: string;
  paymentMethod: PaymentMethod;
  mobileMoneyType?: MobileMoneyType;
  description?: string;
  notes?: string;
  date: string;       // YYYY-MM-DD
  timeOfDay?: string; // HH:MM
  isRecurring: boolean;
  recurringInterval?: 'daily' | 'weekly' | 'monthly';
  receiptImageUrl?: string;
  isSplit: boolean;
  splitTotal?: number;
  splitCount?: number;
  roundupAmount: number;
  aiCategorized: boolean;
  aiConfidence?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateExpenseInput {
  amount: number;
  currency?: Currency;
  category: ExpenseCategory;
  merchantName?: string;
  paymentMethod: PaymentMethod;
  mobileMoneyType?: MobileMoneyType;
  description?: string;
  notes?: string;
  date: string;
  timeOfDay?: string;
  isRecurring?: boolean;
  recurringInterval?: 'daily' | 'weekly' | 'monthly';
  receiptImageUrl?: string;
}

// ─── Income ───────────────────────────────────────────────────────────────────

export interface IncomeEntry {
  id: string;
  userId: string;
  source: IncomeSource;
  sourceName?: string;
  amount: number;
  currency: Currency;
  date: string;
  isRecurring: boolean;
  interval?: 'weekly' | 'monthly' | 'yearly';
  notes?: string;
  createdAt: string;
}

// ─── Budgets ──────────────────────────────────────────────────────────────────

export interface Budget {
  id: string;
  userId: string;
  category: ExpenseCategory | 'overall';
  limitAmount: number;
  period: BudgetPeriod;
  rollover: boolean;
  aiSuggested: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetStatus extends Budget {
  spent: number;
  remaining: number;
  percentage: number;
  isOver: boolean;
  isNear: boolean; // >= 80%
}

// ─── Goals ────────────────────────────────────────────────────────────────────

export interface Goal {
  id: string;
  userId: string;
  title: string;
  emoji: string;
  targetAmount: number;
  currentAmount: number;
  deadline?: string;
  priority: number;
  aiWeeklyTarget?: number;
  roundupEnabled: boolean;
  status: 'active' | 'completed' | 'paused';
  createdAt: string;
  updatedAt: string;
}

// ─── Debts ────────────────────────────────────────────────────────────────────

export interface Debt {
  id: string;
  userId: string;
  label: string;
  debtType: DebtType;
  principalAmount: number;
  currentBalance: number;
  interestRatePct: number;
  minPayment?: number;
  dueDayOfMonth?: number;
  lenderName?: string;
  startDate?: string;
  endDate?: string;
  status: 'active' | 'paid';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DebtPayment {
  id: string;
  debtId: string;
  userId: string;
  amount: number;
  date: string;
  notes?: string;
  createdAt: string;
}

// ─── Financial Discipline Score ───────────────────────────────────────────────

export interface FDSComponents {
  budgetAdherence: number; // 0–1
  savingsRate: number;     // 0–1
  consistency: number;     // 0–1
  improvement: number;     // 0–1
}

export interface FDSResult {
  score: number;           // 0–100
  components: FDSComponents;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  trend: 'improving' | 'stable' | 'declining';
  commentary?: string;     // AI-generated
}

export interface DisciplineScore {
  id: string;
  userId: string;
  weekStart: string;
  score: number;
  budgetAdherence: number;
  savingsRate: number;
  consistency: number;
  improvementTrend: number;
  aiCommentary?: string;
  createdAt: string;
}

// ─── Streaks & Badges ─────────────────────────────────────────────────────────

export type BadgeId =
  | 'first_expense'
  | 'first_income'
  | 'first_budget'
  | 'streak_3'
  | 'streak_7'
  | 'streak_30'
  | 'streak_100'
  | 'budget_kept'
  | 'saver'
  | 'goal_setter'
  | 'goal_halfway'
  | 'goal_crusher'
  | 'debt_slayer'
  | 'discipline_a'
  | 'no_spend_day'
  | 'early_bird'
  | 'analyzer'
  | 'receipt_scanner'
  | 'ai_user'
  | 'month_master';

export interface Badge {
  id: BadgeId;
  name: string;
  description: string;
  emoji: string;
  category: 'consistency' | 'savings' | 'budget' | 'milestone' | 'behaviour';
}

export interface UnlockedBadge {
  userId: string;
  badgeId: BadgeId;
  unlockedAt: string;
}

export interface StreakData {
  userId: string;
  currentStreak: number;
  longestStreak: number;
  lastActiveDate?: string;
}

// ─── AI & Intelligence ────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  actions?: QuickAction[];
}

export interface QuickAction {
  label: string;
  action: 'create_budget' | 'create_goal' | 'view_forecast' | 'view_score' | 'add_expense';
  payload?: Record<string, unknown>;
}

export interface CategorizationResult {
  category: ExpenseCategory;
  confidence: number;
  source: 'llm' | 'rule' | 'user';
}

export interface AnomalyResult {
  isAnomaly: boolean;
  modifiedZScore: number;
  median: number;
  mad: number;
  explanation: string;
}

export interface ForecastResult {
  projectedMonthEnd: number;
  dailyRate: number;
  confidence: 'high' | 'medium' | 'low';
  actualToDate: number;
  remainingDays: number;
  byCategory: CategoryForecast[];
}

export interface CategoryForecast {
  category: ExpenseCategory;
  actualToDate: number;
  projected: number;
  budget?: number;
  status: 'on_track' | 'at_risk' | 'over';
}

export interface ReceiptOCRResult {
  merchantName?: string;
  totalAmount?: number;
  currency?: Currency;
  date?: string;
  suggestedCategory?: ExpenseCategory;
  confidence: number;
  lineItems: Array<{ name: string; amount: number }>;
}

// ─── Notifications ────────────────────────────────────────────────────────────

export type NotificationType =
  | 'budget_alert'
  | 'anomaly'
  | 'forecast'
  | 'streak'
  | 'discipline'
  | 'goal'
  | 'bill_reminder';

export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sentAt: string;
  readAt?: string;
}

// ─── Weekly Reflection ────────────────────────────────────────────────────────

export interface WeeklyReflection {
  id: string;
  userId: string;
  weekStart: string;
  exceededCategory?: ExpenseCategory;
  adjustNextWeek: boolean;
  smallChange?: string;
  moodRating?: 1 | 2 | 3 | 4 | 5;
  aiResponse?: string;
  createdAt: string;
}

// ─── API Payloads ─────────────────────────────────────────────────────────────

export interface AIAdvisorRequest {
  message: string;
  conversationId?: string;
}

export interface AIAdvisorResponse {
  reply: string;
  conversationId: string;
  actions?: QuickAction[];
}

export interface CategorizeRequest {
  description: string;
  amount: number;
  merchantHint?: string;
}

export interface ForecastRequest {
  userId: string;
}

export interface AnomalyCheckRequest {
  expenseId: string;
}

export interface ComputeFDSRequest {
  userId: string;
  weekStart: string;
}
