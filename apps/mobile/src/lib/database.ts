import * as SQLite from 'expo-sqlite';
import type { Expense, Budget, Goal, IncomeEntry, StreakData, Debt, DebtPayment } from '@spendwise/shared';

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
      description   TEXT,
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

    CREATE TABLE IF NOT EXISTS debts (
      id                TEXT PRIMARY KEY,
      user_id           TEXT NOT NULL,
      label             TEXT NOT NULL,
      debt_type         TEXT NOT NULL,
      principal_amount  REAL NOT NULL,
      current_balance   REAL NOT NULL,
      interest_rate_pct REAL NOT NULL DEFAULT 0,
      min_payment       REAL,
      due_day_of_month  INTEGER,
      lender_name       TEXT,
      start_date        TEXT,
      end_date          TEXT,
      status            TEXT NOT NULL DEFAULT 'active',
      notes             TEXT,
      synced            INTEGER NOT NULL DEFAULT 0,
      created_at        TEXT NOT NULL,
      updated_at        TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS debt_payments (
      id         TEXT PRIMARY KEY,
      debt_id    TEXT NOT NULL,
      user_id    TEXT NOT NULL,
      amount     REAL NOT NULL,
      date       TEXT NOT NULL,
      notes      TEXT,
      synced     INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
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
    CREATE INDEX IF NOT EXISTS idx_debt_payments_debt ON debt_payments(debt_id, date DESC);
  `);

  // `CREATE TABLE IF NOT EXISTS` above only shapes brand-new local databases —
  // devices with an existing spendwise.db from before `description` existed
  // need it added on top. Errors if the column is already there, which is
  // the expected/harmless case, so it's swallowed rather than surfaced.
  try {
    await db.execAsync(`ALTER TABLE budgets ADD COLUMN description TEXT;`);
  } catch {}
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
    DELETE FROM debts;
    DELETE FROM debt_payments;
    DELETE FROM streak;
    DELETE FROM sync_queue;
  `);
}

// ─── Expenses ─────────────────────────────────────────────────────────────────

/** `synced` should be true only when writing data that just came from the
 *  server — new local writes default to false so a failed/offline push to
 *  Supabase can be detected and retried instead of silently disappearing. */
export async function dbInsertExpense(expense: Expense, synced = false): Promise<void> {
  const db = await getDB();
  await db.runAsync(
    `INSERT OR REPLACE INTO expenses
     (id, user_id, amount, currency, category, merchant_name, payment_method,
      mobile_money_type, description, notes, date, time_of_day, is_recurring,
      roundup_amount, ai_categorized, ai_confidence, synced, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [expense.id, expense.userId, expense.amount, expense.currency,
     expense.category, expense.merchantName ?? null, expense.paymentMethod,
     expense.mobileMoneyType ?? null, expense.description ?? null,
     expense.notes ?? null, expense.date, expense.timeOfDay ?? null,
     expense.isRecurring ? 1 : 0, expense.roundupAmount,
     expense.aiCategorized ? 1 : 0, expense.aiConfidence ?? null,
     synced ? 1 : 0, expense.createdAt, expense.updatedAt],
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

export async function dbGetUnsyncedExpenses(userId: string): Promise<Expense[]> {
  const db = await getDB();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM expenses WHERE user_id = ? AND synced = 0`, [userId],
  );
  return rows.map(rowToExpense);
}

export async function dbMarkExpenseSynced(id: string): Promise<void> {
  const db = await getDB();
  await db.runAsync(`UPDATE expenses SET synced = 1 WHERE id = ?`, [id]);
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
     (id, user_id, category, description, limit_amount, period, rollover, ai_suggested, synced, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,0,?,?)`,
    [budget.id, budget.userId, budget.category, budget.description ?? null, budget.limitAmount,
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

// ─── Debts ────────────────────────────────────────────────────────────────────

export async function dbGetDebts(userId: string): Promise<Debt[]> {
  const db = await getDB();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM debts WHERE user_id = ? ORDER BY status ASC, current_balance DESC`, [userId],
  );
  return rows.map(rowToDebt);
}

export async function dbUpsertDebt(debt: Debt): Promise<void> {
  const db = await getDB();
  await db.runAsync(
    `INSERT OR REPLACE INTO debts
     (id, user_id, label, debt_type, principal_amount, current_balance, interest_rate_pct,
      min_payment, due_day_of_month, lender_name, start_date, end_date, status, notes,
      synced, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,?,?)`,
    [debt.id, debt.userId, debt.label, debt.debtType, debt.principalAmount, debt.currentBalance,
     debt.interestRatePct, debt.minPayment ?? null, debt.dueDayOfMonth ?? null,
     debt.lenderName ?? null, debt.startDate ?? null, debt.endDate ?? null, debt.status,
     debt.notes ?? null, debt.createdAt, debt.updatedAt],
  );
}

export async function dbDeleteDebt(id: string): Promise<void> {
  const db = await getDB();
  await db.runAsync(`DELETE FROM debts WHERE id = ?`, [id]);
  await db.runAsync(`DELETE FROM debt_payments WHERE debt_id = ?`, [id]);
}

export async function dbGetDebtPayments(debtId: string): Promise<DebtPayment[]> {
  const db = await getDB();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM debt_payments WHERE debt_id = ? ORDER BY date DESC`, [debtId],
  );
  return rows.map(rowToDebtPayment);
}

export async function dbInsertDebtPayment(payment: DebtPayment): Promise<void> {
  const db = await getDB();
  await db.runAsync(
    `INSERT OR REPLACE INTO debt_payments (id, debt_id, user_id, amount, date, notes, synced, created_at)
     VALUES (?,?,?,?,?,?,0,?)`,
    [payment.id, payment.debtId, payment.userId, payment.amount, payment.date,
     payment.notes ?? null, payment.createdAt],
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
    category: String(row.category) as any,
    description: row.description ? String(row.description) : undefined,
    limitAmount: Number(row.limit_amount),
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

function rowToDebt(row: Record<string, unknown>): Debt {
  return {
    id: String(row.id), userId: String(row.user_id),
    label: String(row.label), debtType: String(row.debt_type) as any,
    principalAmount: Number(row.principal_amount), currentBalance: Number(row.current_balance),
    interestRatePct: Number(row.interest_rate_pct ?? 0),
    minPayment: row.min_payment != null ? Number(row.min_payment) : undefined,
    dueDayOfMonth: row.due_day_of_month != null ? Number(row.due_day_of_month) : undefined,
    lenderName: row.lender_name ? String(row.lender_name) : undefined,
    startDate: row.start_date ? String(row.start_date) : undefined,
    endDate: row.end_date ? String(row.end_date) : undefined,
    status: String(row.status) as any,
    notes: row.notes ? String(row.notes) : undefined,
    createdAt: String(row.created_at), updatedAt: String(row.updated_at),
  };
}

function rowToDebtPayment(row: Record<string, unknown>): DebtPayment {
  return {
    id: String(row.id), debtId: String(row.debt_id), userId: String(row.user_id),
    amount: Number(row.amount), date: String(row.date),
    notes: row.notes ? String(row.notes) : undefined,
    createdAt: String(row.created_at),
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
