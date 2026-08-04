import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { dbGetBudgets, dbUpsertBudget, dbDeleteBudget, dbGetQueuedIdsByOperation } from '@/lib/database';
import { writeAndSync } from '@/lib/syncEngine';
import { mergeSyncedRows } from '@spendwise/shared';
import type { Budget } from '@spendwise/shared';

interface BudgetState {
  budgets: Budget[];
  loading: boolean;
  load:           (userId: string) => Promise<void>;
  upsertBudget:   (budget: Budget) => Promise<void>;
  deleteBudget:   (id: string) => Promise<void>;
  reset:          () => void;
}

export const useBudgetStore = create<BudgetState>((set, get) => ({
  budgets: [],
  loading: false,

  load: async (userId) => {
    set({ loading: true });
    try {
      const local = await dbGetBudgets(userId);
      set({ budgets: local });

      const { data } = await supabase.from('budgets').select('*').eq('user_id', userId);
      if (!data) return;

      const mapped = data.map(remoteToBudget);
      const { upsertIds, deleteIds } = await dbGetQueuedIdsByOperation('budgets');

      for (const b of mapped) {
        if (!upsertIds.has(b.id) && !deleteIds.has(b.id)) await dbUpsertBudget(b);
      }

      set({ budgets: mergeSyncedRows(mapped, local, upsertIds, deleteIds) });
    } finally {
      set({ loading: false });
    }
  },

  upsertBudget: async (budget) => {
    await dbUpsertBudget(budget);
    set(s => {
      const existing = s.budgets.findIndex(b => b.id === budget.id);
      if (existing >= 0) {
        const updated = [...s.budgets];
        updated[existing] = budget;
        return { budgets: updated };
      }
      return { budgets: [...s.budgets, budget] };
    });
    await writeAndSync('budgets', budget.id, 'upsert', budgetToRemote(budget));
  },

  deleteBudget: async (id) => {
    await dbDeleteBudget(id);
    set(s => ({ budgets: s.budgets.filter(b => b.id !== id) }));
    await writeAndSync('budgets', id, 'delete', null);
  },

  reset: () => set({ budgets: [], loading: false }),
}));

function remoteToBudget(r: Record<string, unknown>): Budget {
  return {
    id: String(r.id), userId: String(r.user_id),
    category: r.category as any, description: r.description ? String(r.description) : undefined,
    limitAmount: Number(r.limit_amount),
    period: (r.period as any) ?? 'monthly', rollover: Boolean(r.rollover),
    aiSuggested: Boolean(r.ai_suggested),
    createdAt: String(r.created_at), updatedAt: String(r.updated_at),
  };
}

function budgetToRemote(b: Budget): Record<string, unknown> {
  return {
    id: b.id, user_id: b.userId, category: b.category, description: b.description ?? null,
    limit_amount: b.limitAmount, period: b.period,
    rollover: b.rollover, ai_suggested: b.aiSuggested,
    created_at: b.createdAt, updated_at: b.updatedAt,
  };
}
