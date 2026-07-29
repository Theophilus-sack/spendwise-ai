import type { Badge, BadgeId, ExpenseCategory, Currency, DebtType, SpendingPersonality, DisciplineStyle } from './types';

// ─── Expense Categories ───────────────────────────────────────────────────────

export const CATEGORIES: Record<ExpenseCategory, { label: string; emoji: string; color: string }> = {
  food:          { label: 'Food & Dining',     emoji: '🍔', color: '#FF6B6B' },
  transport:     { label: 'Transport',          emoji: '🚗', color: '#4ECDC4' },
  groceries:     { label: 'Groceries',          emoji: '🛒', color: '#45B7D1' },
  bills:         { label: 'Bills & Utilities',  emoji: '💡', color: '#96CEB4' },
  shopping:      { label: 'Shopping',           emoji: '🛍️', color: '#FFEAA7' },
  entertainment: { label: 'Entertainment',      emoji: '🎬', color: '#DDA0DD' },
  health:        { label: 'Health',             emoji: '💊', color: '#98D8C8' },
  education:     { label: 'Education',          emoji: '📚', color: '#F7DC6F' },
  rent:          { label: 'Rent',               emoji: '🏠', color: '#A8D8EA' },
  savings:       { label: 'Savings',            emoji: '💰', color: '#2ECC71' },
  other:         { label: 'Other',              emoji: '✨', color: '#BDC3C7' },
};

export const CATEGORY_LIST = Object.keys(CATEGORIES) as ExpenseCategory[];

// ─── Payment Methods ──────────────────────────────────────────────────────────

export const PAYMENT_METHODS = {
  mobile_money: { label: 'Mobile Money', emoji: '📱' },
  card:         { label: 'Card',         emoji: '💳' },
  cash:         { label: 'Cash',         emoji: '💵' },
} as const;

export const MOBILE_MONEY_TYPES = {
  mtn_momo:      { label: 'MTN MoMo',          emoji: '📲', color: '#FFC107' },
  vodafone_cash: { label: 'Vodafone Cash',      emoji: '📲', color: '#E53935' },
  airteltigo:    { label: 'AirtelTigo Money',   emoji: '📲', color: '#1565C0' },
};

// ─── Currencies ───────────────────────────────────────────────────────────────

export const CURRENCIES: Record<Currency, { symbol: string; name: string }> = {
  GHS: { symbol: '₵',  name: 'Ghanaian Cedi' },
  USD: { symbol: '$',  name: 'US Dollar' },
  EUR: { symbol: '€',  name: 'Euro' },
  GBP: { symbol: '£',  name: 'British Pound' },
  NGN: { symbol: '₦',  name: 'Nigerian Naira' },
  KES: { symbol: 'KSh', name: 'Kenyan Shilling' },
  ZAR: { symbol: 'R',  name: 'South African Rand' },
  INR: { symbol: '₹',  name: 'Indian Rupee' },
};

// ─── Income Sources ───────────────────────────────────────────────────────────

export const INCOME_SOURCES = {
  salary:      { label: 'Salary / Wages',   emoji: '💼' },
  freelance:   { label: 'Freelance',         emoji: '💻' },
  business:    { label: 'Business',          emoji: '🏢' },
  investments: { label: 'Investments',       emoji: '📈' },
  allowance:   { label: 'Allowance',         emoji: '🎓' },
  other:       { label: 'Other',             emoji: '💫' },
};

// ─── Spending Personality & Discipline Style ───────────────────────────────────
// Shared between onboarding and Settings so both offer the exact same choices.

export const SPENDING_PERSONALITIES: Array<{ id: SpendingPersonality; label: string; emoji: string; desc: string }> = [
  { id: 'saver',    label: 'Saver',    emoji: '🐷', desc: "I save first, spend what's left" },
  { id: 'balanced', label: 'Balanced', emoji: '⚖️', desc: 'I try to balance saving and spending' },
  { id: 'spender',  label: 'Spender',  emoji: '🛍️', desc: 'I spend freely and save when I can' },
];

export const DISCIPLINE_STYLES: Array<{ id: DisciplineStyle; label: string; emoji: string; desc: string }> = [
  { id: 'strict',   label: 'Strict',   emoji: '🔒', desc: 'Warn me hard when I go over budget' },
  { id: 'flexible', label: 'Flexible', emoji: '😊', desc: 'Gentle nudges are enough for me' },
];

// ─── Spending Alternatives ──────────────────────────────────────────────────
// Rule-based, Ghana-specific suggestions per category — used by both the
// What-If simulator and the Weekly Reflection prompt. Deliberately not
// cross-user "people like you" recommendations: those need a real user base
// at meaningful scale to say anything true. This is the honest version until
// then — a curated list, not a fabricated pattern.

export const SPENDING_ALTERNATIVES: Partial<Record<ExpenseCategory, string[]>> = {
  food:          ['Cook at home instead of eating out', 'Use meal-prep to reduce daily food cost', 'Try local chop bars instead of restaurants'],
  transport:     ['Use trotro instead of Uber for short trips', 'Carpool with colleagues', 'Walk or cycle for trips under 2 km'],
  entertainment: ['Use free streaming trials before paying', 'Explore free community events', 'Share subscriptions with family'],
  shopping:      ['Buy from local markets instead of malls', 'Wait for sales before non-urgent purchases', 'Buy second-hand for non-essentials'],
  groceries:     ['Buy in bulk from wholesale markets', 'Switch to store-brand products', 'Plan meals to reduce food waste'],
  health:        ['Use NHIS-covered facilities for check-ups', 'Buy generic medications', 'Focus on preventive health habits'],
};

// ─── Debt Types ───────────────────────────────────────────────────────────────

export const DEBT_TYPES: Record<DebtType, { label: string; emoji: string; direction: 'owe' | 'owed' }> = {
  loan:        { label: 'Loan',              emoji: '🏦', direction: 'owe' },
  credit_card: { label: 'Credit Card',       emoji: '💳', direction: 'owe' },
  i_owe:       { label: 'I Owe Someone',     emoji: '🤝', direction: 'owe' },
  owed_to_me:  { label: 'Owed to Me',        emoji: '💰', direction: 'owed' },
};

// ─── Income Ranges ────────────────────────────────────────────────────────────

export const INCOME_RANGES = [
  { label: 'Less than ₵500',       value: 'under_500',    midpoint: 300 },
  { label: '₵500 – ₵1,000',        value: '500_1000',     midpoint: 750 },
  { label: '₵1,000 – ₵2,000',      value: '1000_2000',    midpoint: 1500 },
  { label: '₵2,000 – ₵5,000',      value: '2000_5000',    midpoint: 3500 },
  { label: '₵5,000 – ₵10,000',     value: '5000_10000',   midpoint: 7500 },
  { label: 'More than ₵10,000',    value: 'over_10000',   midpoint: 12000 },
];

// ─── Financial Goals (Onboarding) ─────────────────────────────────────────────

export const ONBOARDING_GOALS = [
  { id: 'save_money',       label: 'Save money',              emoji: '💰' },
  { id: 'reduce_spending',  label: 'Reduce spending',         emoji: '✂️' },
  { id: 'track_habits',     label: 'Track my habits',         emoji: '📊' },
  { id: 'emergency_fund',   label: 'Build emergency fund',    emoji: '🛡️' },
  { id: 'pay_debt',         label: 'Pay off debt',            emoji: '📉' },
  { id: 'invest',           label: 'Start investing',         emoji: '📈' },
];

// ─── Badges ───────────────────────────────────────────────────────────────────

export const BADGES: Record<BadgeId, Badge> = {
  first_expense:   { id: 'first_expense',   name: 'First Step',      emoji: '👣', description: 'Logged your first expense',              category: 'milestone' },
  first_income:    { id: 'first_income',    name: 'Earner',           emoji: '💼', description: 'Added your first income source',          category: 'milestone' },
  first_budget:    { id: 'first_budget',    name: 'Planner',          emoji: '📋', description: 'Created your first budget',               category: 'budget' },
  streak_3:        { id: 'streak_3',        name: 'On Fire',          emoji: '🔥', description: '3-day logging streak',                    category: 'consistency' },
  streak_7:        { id: 'streak_7',        name: 'Week Warrior',     emoji: '⚔️', description: '7-day logging streak',                    category: 'consistency' },
  streak_30:       { id: 'streak_30',       name: 'Money Master',     emoji: '👑', description: '30-day logging streak',                   category: 'consistency' },
  streak_100:      { id: 'streak_100',      name: 'Legendary',        emoji: '🏆', description: '100-day logging streak',                  category: 'consistency' },
  budget_kept:     { id: 'budget_kept',     name: 'Disciplined',      emoji: '🎯', description: 'Stayed under budget for a full month',    category: 'budget' },
  saver:           { id: 'saver',           name: 'Smart Saver',      emoji: '🐷', description: 'Saved more than you spent',               category: 'savings' },
  goal_setter:     { id: 'goal_setter',     name: 'Goal Setter',      emoji: '🎯', description: 'Created your first savings goal',         category: 'savings' },
  goal_halfway:    { id: 'goal_halfway',    name: 'Halfway There',    emoji: '🚀', description: 'Reached 50% of a savings goal',           category: 'savings' },
  goal_crusher:    { id: 'goal_crusher',    name: 'Goal Crusher',     emoji: '💪', description: 'Completed a savings goal',                category: 'savings' },
  debt_slayer:     { id: 'debt_slayer',     name: 'Debt Slayer',      emoji: '⚡', description: 'Made your first debt payment',            category: 'milestone' },
  discipline_a:    { id: 'discipline_a',    name: 'Grade A',          emoji: '🌟', description: 'Earned an A on your Discipline Score',    category: 'budget' },
  no_spend_day:    { id: 'no_spend_day',    name: 'No Spend Day',     emoji: '🧊', description: 'Completed a no-spend day',                category: 'behaviour' },
  early_bird:      { id: 'early_bird',      name: 'Early Bird',       emoji: '🌅', description: 'Logged an expense before 8am',            category: 'behaviour' },
  analyzer:        { id: 'analyzer',        name: 'Analyzer',         emoji: '🔍', description: 'Viewed your analytics for the first time', category: 'milestone' },
  receipt_scanner: { id: 'receipt_scanner', name: 'Scanner',          emoji: '📸', description: 'Scanned your first receipt',              category: 'milestone' },
  ai_user:         { id: 'ai_user',         name: 'AI Explorer',      emoji: '🤖', description: 'Had your first AI advisor conversation',  category: 'milestone' },
  month_master:    { id: 'month_master',    name: 'Month Master',     emoji: '📅', description: 'Completed a full month of tracking',      category: 'consistency' },
};

// ─── FDS Score Weights ────────────────────────────────────────────────────────

export const FDS_WEIGHTS = {
  budgetAdherence: 0.35,
  savingsRate:     0.30,
  consistency:     0.20,
  improvement:     0.15,
} as const;

// ─── Default Budget Allocations (% of income) ─────────────────────────────────

export const DEFAULT_BUDGET_PCT: Partial<Record<ExpenseCategory, number>> = {
  food:          0.20,
  transport:     0.10,
  groceries:     0.15,
  bills:         0.10,
  shopping:      0.05,
  entertainment: 0.05,
  health:        0.05,
  education:     0.05,
  rent:          0.00, // varies too much to default
  savings:       0.20,
};

// ─── Anomaly Detection ────────────────────────────────────────────────────────

export const ANOMALY_THRESHOLD = 3.5; // Iglewicz-Hoaglin modified Z-score threshold
export const MIN_HISTORY_FOR_ANOMALY = 8; // minimum transactions needed before detection kicks in

// ─── Forecast ─────────────────────────────────────────────────────────────────

export const FORECAST_ALPHA = 0.85;    // exponential decay weight
export const FORECAST_AT_RISK_PCT = 0.85; // forecast > 85% of budget = at_risk
