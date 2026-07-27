import * as SQLite from 'expo-sqlite';
import type { Expense, Budget, Goal, IncomeEntry, StreakData } from '@spendwise/shared';

let _db: SQLite.SQLiteDatabase | null = null;

export async function getDB(): Promise<SQLite.SQLiteDatabase> {
  if (_db) return _db;
  _db = await SQLite.openDatabaseAsync('spendwise.db');
  await initSchema(_db);
  return _db;
}

async function initSchema(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS expenses (
      id              TEXT PRIMARY KEY,
      user_id         TEXT NOT NULL,
      amount          REAL NOT NULL,
      currency        TEXT NOT NULL DEFAULT 'GHS',
      category        TEXT NOT NULL,
      merchant_name   TEXT,
      payment_method  TEXT NOT NULL,
      mobile_money_type TEXT,
      description     TEXT,
      notes           TEXT,
      date            TEXT NOT NULL,
      time_of_day     TEXT,
      is_recurring    INTEGER NOT NULL DEFAULT 0,
      roundup_amount  REAL NOT NULL DEFAULT 0,
      ai_categorized  INTEGER NOT NULL DEFAULT 0,
      ai_confidence   REAL,
      synced          INTEGER NOT NULL DEFAULT 0,
      created_at      TEXT NOT NULL,
      updated_at      TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS budgets (
      id            TEXT PRIMARY KEY,
      user_id       TEXT NOT NULL,
      category      TEXT NOT NULL,
      limit_amount  REAL NOT NULL,
      period        TEXT NOT NULL DEFAULT 'monthly',
      rollover      INTEGER NOT NULL DEFAULT 0,
      ai_suggested  INTEGER NOT NULL DEFAULT 0,
      synced        INTEGER NOT NULL DEFAULT 0,
      created_at    TEXT NOT NULL,
      updated_at    TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS goals (
      id               TEXT PRIMARY KEY,
      user_id          TEXT NOT NULL,
      title            TEXT NOT NULL,
      emoji            TEXT NOT NULL DEFAULT '🎯',
      target_amount    REAL NOT NULL,
      current_amount   REAL NOT NULL DEFAULT 0,
      deadline         TEXT,
      priority         INTEGER NOT NULL DEFAULT 1,
      roundup_enabled  INTEGER NOT NULL DEFAULT 0,
      status           TEXT NOT NULL DEFAULT 'active',
      synced           INTEGER NOT NULL DEFAULT 0,
      created_at       TEXT NOT NULL,
      updated_at       TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS income_entries (
      id           TEXT PRIMARY KEY,
      user_id      TEXT NOT NULL,
      source       TEXT NOT NULL,
      source_name  TEXT,
      amount       REAL NOT NULL,
      currency     TEXT NOT NULL DEFAULT 'GHS',
      date         TEXT NOT NULL,
      is_recurring INTEGER NOT NULL DEFAULT 0,
      interval     TEXT,
      notes        TEXT,
      synced       INTEGER NOT NULL DEFAULT 0,
      created_at   TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS streak (
      user_id          TEXT PRIMARY KEY,
      current_streak   INTEGER NOT NULL DEFAULT 0,
      longest_streak   INTEGER NOT NULL DEFAULT 0,
      last_active_date TEXT,
      updated_at       TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sync_queue (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      table_name TEXT NOT NULL,
      record_id  TEXT NOT NULL,
      operation  TEXT NOT NULL,
      payload    TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON expenses(user_id, date DESC);
    CREATE INDEX IF NOT EXISTS idx_expenses_category  ON expenses(user_id, category);
    CREATE INDEX IF NOT EXISTS idx_sync_queue_table   ON sync_queue(table_name);
  `);
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

/** Wipes every local table. Called on sign-out so a signed-out account's
 *  financial data doesn't keep sitting in on-device storage — important both
 *  for privacy on a shared/borrowed device and so a different account signing
 *  in next can never read another user's rows out of the local cache. */
export async function dbClearAll(): Promise<void> {
  const db = await getDB();
  await db.execAsync(`
    DELETE FROM expenses;
    DELETE FROM budgets;
    DELETE FROM goals;
    DELETE FROM income_entries;
    DELETE FROM streak;
    DELETE FROM sync_queue;
  `);
}

// ─── Expenses ─────────────────────────────────────────────────────────────────

export async function dbInsertExpense(expense: Expense): Promise<void> {
  const db = await getDB();
  await db.runAsync(
    `INSERT OR REPLACE INTO expenses
     (id, user_id, amount, currency, category, merchant_name, payment_method,
      mobile_money_type, description, notes, date, time_of_day, is_recurring,
      roundup_amount, ai_categorized, ai_confidence, synced, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,?,?)`,
    [expense.id, expense.userId, expense.amount, expense.currency,
     expense.category, expense.merchantName ?? null, expense.paymentMethod,
     expense.mobileMoneyType ?? null, expense.description ?? null,
     expense.notes ?? null, expense.date, expense.timeOfDay ?? null,
     expense.isRecurring ? 1 : 0, expense.roundupAmount,
     expense.aiCategorized ? 1 : 0, expense.aiConfidence ?? null,
     expense.createdAt, expense.updatedAt],
  );
}

export async function dbGetExpenses(userId: string, limit = 500): Promise<Expense[]> {
  const db = await getDB();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM expenses WHERE user_id = ? ORDER BY date DESC, created_at DESC LIMIT ?`,
    [userId, limit],
  );
  return rows.map(rowToExpense);
}

export async function dbDeleteExpense(id: string): Promise<void> {
  const db = await getDB();
  await db.runAsync(`DELETE FROM expenses WHERE id = ?`, [id]);
}

// ─── Budgets ──────────────────────────────────────────────────────────────────

export async function dbGetBudgets(userId: string): Promise<Budget[]> {
  const db = await getDB();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM budgets WHERE user_id = ?`, [userId],
  );
  return rows.map(rowToBudget);
}

export async function dbUpsertBudget(budget: Budget): Promise<void> {
  const db = await getDB();
  await db.runAsync(
    `INSERT OR REPLACE INTO budgets
     (id, user_id, category, limit_amount, period, rollover, ai_suggested, synced, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,0,?,?)`,
    [budget.id, budget.userId, budget.category, budget.limitAmount,
     budget.period, budget.rollover ? 1 : 0, budget.aiSuggested ? 1 : 0,
     budget.createdAt, budget.updatedAt],
  );
}

// ─── Goals ────────────────────────────────────────────────────────────────────

export async function dbGetGoals(userId: string): Promise<Goal[]> {
  const db = await getDB();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM goals WHERE user_id = ? AND status != 'deleted' ORDER BY priority ASC`,
    [userId],
  );
  return rows.map(rowToGoal);
}

export async function dbUpsertGoal(goal: Goal): Promise<void> {
  const db = await getDB();
  await db.runAsync(
    `INSERT OR REPLACE INTO goals
     (id, user_id, title, emoji, target_amount, current_amount, deadline,
      priority, roundup_enabled, status, synced, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,0,?,?)`,
    [goal.id, goal.userId, goal.title, goal.emoji, goal.targetAmount,
     goal.currentAmount, goal.deadline ?? null, goal.priority,
     goal.roundupEnabled ? 1 : 0, goal.status, goal.createdAt, goal.updatedAt],
  );
}

// ─── Income ───────────────────────────────────────────────────────────────────

export async function dbGetIncome(userId: string): Promise<IncomeEntry[]> {
  const db = await getDB();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM income_entries WHERE user_id = ? ORDER BY date DESC`, [userId],
  );
  return rows.map(rowToIncome);
}

export async function dbUpsertIncome(entry: IncomeEntry): Promise<void> {
  const db = await getDB();
  await db.runAsync(
    `INSERT OR REPLACE INTO income_entries
     (id, user_id, source, source_name, amount, currency, date, is_recurring, interval, notes, synced, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,0,?)`,
    [entry.id, entry.userId, entry.source, entry.sourceName ?? null,
     entry.amount, entry.currency, entry.date, entry.isRecurring ? 1 : 0,
     entry.interval ?? null, entry.notes ?? null, entry.createdAt],
  );
}

// ─── Streak ───────────────────────────────────────────────────────────────────

export async function dbGetStreak(userId: string): Promise<StreakData | null> {
  const db = await getDB();
  const row = await db.getFirstAsync<Record<string, unknown>>(
    `SELECT * FROM streak WHERE user_id = ?`, [userId],
  );
  if (!row) return null;
  return {
    userId: String(row.user_id),
    currentStreak: Number(row.current_streak),
    longestStreak: Number(row.longest_streak),
    lastActiveDate: row.last_active_date ? String(row.last_active_date) : undefined,
  };
}

export async function dbUpsertStreak(streak: StreakData): Promise<void> {
  const db = await getDB();
  await db.runAsync(
    `INSERT OR REPLACE INTO streak (user_id, current_streak, longest_streak, last_active_date, updated_at)
     VALUES (?,?,?,?,?)`,
    [streak.userId, streak.currentStreak, streak.longestStreak,
     streak.lastActiveDate ?? null, new Date().toISOString()],
  );
}

// ─── Row mappers ──────────────────────────────────────────────────────────────

function rowToExpense(row: Record<string, unknown>): Expense {
  return {
    id: String(row.id), userId: String(row.user_id),
    amount: Number(row.amount), currency: String(row.currency) as any,
    category: String(row.category) as any,
    merchantName: row.merchant_name ? String(row.merchant_name) : undefined,
    paymentMethod: String(row.payment_method) as any,
    mobileMoneyType: row.mobile_money_type ? String(row.mobile_money_type) as any : undefined,
    description: row.description ? String(row.description) : undefined,
    notes: row.notes ? String(row.notes) : undefined,
    date: String(row.date), timeOfDay: row.time_of_day ? String(row.time_of_day) : undefined,
    isRecurring: Number(row.is_recurring) === 1,
    isSplit: false, roundupAmount: Number(row.roundup_amount),
    aiCategorized: Number(row.ai_categorized) === 1,
    aiConfidence: row.ai_confidence ? Number(row.ai_confidence) : undefined,
    createdAt: String(row.created_at), updatedAt: String(row.updated_at),
  };
}

function rowToBudget(row: Record<string, unknown>): Budget {
  return {
    id: String(row.id), userId: String(row.user_id),
    category: String(row.category) as any, limitAmount: Number(row.limit_amount),
    period: String(row.period) as any, rollover: Number(row.rollover) === 1,
    aiSuggested: Number(row.ai_suggested) === 1,
    createdAt: String(row.created_at), updatedAt: String(row.updated_at),
  };
}

function rowToGoal(row: Record<string, unknown>): Goal {
  return {
    id: String(row.id), userId: String(row.user_id),
    title: String(row.title), emoji: String(row.emoji),
    targetAmount: Number(row.target_amount), currentAmount: Number(row.current_amount),
    deadline: row.deadline ? String(row.deadline) : undefined,
    priority: Number(row.priority),
    roundupEnabled: Number(row.roundup_enabled) === 1,
    status: String(row.status) as any,
    createdAt: String(row.created_at), updatedAt: String(row.updated_at),
  };
}

function rowToIncome(row: Record<string, unknown>): IncomeEntry {
  return {
    id: String(row.id), userId: String(row.user_id),
    source: String(row.source) as any, sourceName: row.source_name ? String(row.source_name) : undefined,
    amount: Number(row.amount), currency: String(row.currency) as any,
    date: String(row.date), isRecurring: Number(row.is_recurring) === 1,
    interval: row.interval ? String(row.interval) as any : undefined,
    notes: row.notes ? String(row.notes) : undefined,
    createdAt: String(row.created_at),
  };
}
