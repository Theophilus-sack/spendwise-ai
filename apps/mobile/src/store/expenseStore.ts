import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { dbInsertExpense, dbGetExpenses, dbDeleteExpense, dbGetQueuedIdsByOperation } from '@/lib/database';
import { writeAndSync } from '@/lib/syncEngine';
import {
  todayISO, startOfMonthISO, groupBy, sumBy,
  categorizeLocally, LOW_CONFIDENCE_THRESHOLD, generateUUID, mergeSyncedRows,
} from '@spendwise/shared';
import type { Expense, CreateExpenseInput, ExpenseCategory, BudgetStatus } from '@spendwise/shared';
import { callEdgeFunction } from '@/lib/supabase';

interface ExpenseState {
  expenses:   Expense[];
  loading:    boolean;

  load:          (userId: string) => Promise<void>;
  addExpense:    (userId: string, input: CreateExpenseInput) => Promise<Expense>;
  deleteExpense: (id: string) => Promise<void>;
  reset:         () => void;

  // Computed selectors
  getThisMonthExpenses:  () => Expense[];
  getTotalThisMonth:     () => number;
  getSpendingByCategory: () => Record<ExpenseCategory, number>;
  getBudgetStatuses:     (budgets: import('@spendwise/shared').Budget[]) => BudgetStatus[];
}

export const useExpenseStore = create<ExpenseState>((set, get) => ({
  expenses: [],
  loading:  false,

  load: async (userId) => {
    set({ loading: true });
    try {
      const local = await dbGetExpenses(userId);
      set({ expenses: local });

      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .limit(500);

      // A failed fetch must not wipe out what's already on screen.
      if (error) return;

      const remote = (data ?? []).map(remoteToExpense);
      const { upsertIds, deleteIds } = await dbGetQueuedIdsByOperation('expenses');

      // Only cache remote rows into local SQLite that aren't currently being
      // fought over by a not-yet-synced local write or delete.
      for (const e of remote) {
        if (!upsertIds.has(e.id) && !deleteIds.has(e.id)) await dbInsertExpense(e, true);
      }

      set({ expenses: mergeSyncedRows(remote, local, upsertIds, deleteIds) });
    } finally {
      set({ loading: false });
    }
  },

  addExpense: async (userId, input) => {
    const now = new Date().toISOString();
    const id  = generateUUID();

    // AI categorization (try cloud, fallback to local rule engine)
    let category = input.category;
    let aiCategorized = false;
    let aiConfidence: number | undefined;

    if (input.description || input.merchantName) {
      try {
        const result = await callEdgeFunction<{ category: ExpenseCategory; confidence: number }>(
          'categorize-expense',
          { description: input.description, amount: input.amount, merchantHint: input.merchantName },
        );
        if (result.confidence >= LOW_CONFIDENCE_THRESHOLD) {
          category = result.category;
          aiCategorized = true;
          aiConfidence = result.confidence;
        }
      } catch {
        // Fallback to local rule engine
        const local = categorizeLocally(input.description ?? '', input.merchantName);
        if (local.confidence >= LOW_CONFIDENCE_THRESHOLD) {
          category = local.category;
          aiCategorized = true;
          aiConfidence = local.confidence;
        }
      }
    }

    const expense: Expense = {
      id, userId,
      amount:          input.amount,
      currency:        input.currency ?? 'GHS',
      category,
      merchantName:    input.merchantName,
      paymentMethod:   input.paymentMethod,
      mobileMoneyType: input.mobileMoneyType,
      description:     input.description,
      notes:           input.notes,
      date:            input.date,
      // Defaults to the actual time of entry when the caller doesn't supply one
      // (e.g. a backdated manual entry) — without this, spending-time analytics
      // like the heatmap would never have any data to work with.
      timeOfDay:       input.timeOfDay ?? now.slice(11, 16),
      isRecurring:     input.isRecurring ?? false,
      isSplit:         false,
      roundupAmount:   0,
      aiCategorized,
      aiConfidence,
      receiptImageUrl: input.receiptImageUrl,
      createdAt:       now,
      updatedAt:       now,
    };

    // Save locally first (offline-safe) — this is the point the user sees as
    // "saved"; everything from here is best-effort sync to the server.
    await dbInsertExpense(expense, false);
    set(s => ({ expenses: [expense, ...s.expenses] }));

    // These edge functions read the expense back out of the `expenses` table
    // server-side, so they only make sense to fire once it's actually there —
    // if the write got queued for later (offline), `synced` is false and they
    // wait; the next successful flush doesn't currently re-fire them, since
    // by design the queue's job is just getting the row to the server, not
    // replaying every side effect that would have followed a live write.
    const { synced } = await writeAndSync('expenses', expense.id, 'upsert', expenseToRemote(expense));
    if (synced) {
      callEdgeFunction('detect-anomaly', { expenseId: id }).catch(() => {});
      callEdgeFunction('check-budget-alert', { category: expense.category }).catch(() => {});
    }

    return expense;
  },

  deleteExpense: async (id) => {
    await dbDeleteExpense(id);
    set(s => ({ expenses: s.expenses.filter(e => e.id !== id) }));
    await writeAndSync('expenses', id, 'delete', null);
  },

  reset: () => set({ expenses: [], loading: false }),

  getThisMonthExpenses: () => {
    const monthStart = startOfMonthISO();
    return get().expenses.filter(e => e.date >= monthStart);
  },

  getTotalThisMonth: () => {
    return sumBy(get().getThisMonthExpenses(), 'amount');
  },

  getSpendingByCategory: () => {
    const grouped = groupBy(get().getThisMonthExpenses(), 'category');
    return Object.fromEntries(
      Object.entries(grouped).map(([cat, exps]) => [cat, sumBy(exps, 'amount')])
    ) as Record<ExpenseCategory, number>;
  },

  getBudgetStatuses: (budgets) => {
    const byCategory = get().getSpendingByCategory();
    return budgets.map(b => {
      const spent = byCategory[b.category as ExpenseCategory] ?? 0;
      const remaining = b.limitAmount - spent;
      const percentage = b.limitAmount > 0 ? (spent / b.limitAmount) * 100 : 0;
      return {
        ...b,
        spent,
        remaining,
        percentage: Math.round(percentage * 10) / 10,
        isOver: spent > b.limitAmount,
        isNear: percentage >= 80 && spent <= b.limitAmount,
      };
    });
  },
}));

// ─── Remote ↔ Local mappers ───────────────────────────────────────────────────

function remoteToExpense(r: Record<string, unknown>): Expense {
  return {
    id: String(r.id), userId: String(r.user_id),
    amount: Number(r.amount), currency: (r.currency as any) ?? 'GHS',
    category: r.category as any, merchantName: r.merchant_name as any,
    paymentMethod: r.payment_method as any, mobileMoneyType: r.mobile_money_type as any,
    description: r.description as any, notes: r.notes as any,
    date: String(r.date), timeOfDay: r.time_of_day as any,
    isRecurring: Boolean(r.is_recurring), isSplit: Boolean(r.is_split),
    roundupAmount: Number(r.roundup_amount ?? 0),
    aiCategorized: Boolean(r.ai_categorized),
    aiConfidence: r.ai_confidence ? Number(r.ai_confidence) : undefined,
    receiptImageUrl: r.receipt_image_url as any,
    createdAt: String(r.created_at), updatedAt: String(r.updated_at),
  };
}

function expenseToRemote(e: Expense): Record<string, unknown> {
  return {
    id: e.id, user_id: e.userId, amount: e.amount, currency: e.currency,
    category: e.category, merchant_name: e.merchantName,
    payment_method: e.paymentMethod, mobile_money_type: e.mobileMoneyType,
    description: e.description, notes: e.notes, date: e.date,
    time_of_day: e.timeOfDay, is_recurring: e.isRecurring,
    roundup_amount: e.roundupAmount, ai_categorized: e.aiCategorized,
    ai_confidence: e.aiConfidence, receipt_image_url: e.receiptImageUrl,
    created_at: e.createdAt, updated_at: e.updatedAt,
  };
}
