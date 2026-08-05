import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { dbGetIncome, dbUpsertIncome, dbDeleteIncome, dbGetQueuedIdsByOperation } from '@/lib/database';
import { writeAndSync } from '@/lib/syncEngine';
import { mergeSyncedRows } from '@spendwise/shared';
import type { IncomeEntry } from '@spendwise/shared';
import { incomeRowSchema, parseRows } from '@/lib/schemas';

interface IncomeState {
  entries:  IncomeEntry[];
  loading:  boolean;
  load:        (userId: string) => Promise<void>;
  addEntry:    (entry: IncomeEntry) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  getTotalThisMonth: () => number;
  reset:       () => void;
}

export const useIncomeStore = create<IncomeState>((set, get) => ({
  entries:  [],
  loading:  false,

  load: async (userId) => {
    set({ loading: true });
    try {
      const local = await dbGetIncome(userId);
      set({ entries: local });

      const { data } = await supabase
        .from('income_entries')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false });
      if (!data) return;

      const mapped = parseRows(incomeRowSchema, data, 'income_entries');
      const { upsertIds, deleteIds } = await dbGetQueuedIdsByOperation('income_entries');

      // Only cache remote rows into local SQLite that aren't currently being
      // fought over by a not-yet-synced local write — otherwise a pending
      // offline edit or delete would get silently overwritten in the local
      // cache the moment this runs, even though the in-memory merge below
      // still shows it correctly for this session.
      for (const e of mapped) {
        if (!upsertIds.has(e.id) && !deleteIds.has(e.id)) await dbUpsertIncome(e);
      }

      set({ entries: mergeSyncedRows(mapped, local, upsertIds, deleteIds) });
    } finally {
      set({ loading: false });
    }
  },

  addEntry: async (entry) => {
    await dbUpsertIncome(entry);
    set(s => ({ entries: [entry, ...s.entries] }));
    await writeAndSync('income_entries', entry.id, 'upsert', incomeToRemote(entry));
  },

  deleteEntry: async (id) => {
    await dbDeleteIncome(id);
    set(s => ({ entries: s.entries.filter(e => e.id !== id) }));
    await writeAndSync('income_entries', id, 'delete', null);
  },

  getTotalThisMonth: () => {
    const now   = new Date();
    const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    return get().entries
      .filter(e => e.date >= start)
      .reduce((sum, e) => sum + e.amount, 0);
  },

  reset: () => set({ entries: [], loading: false }),
}));

function incomeToRemote(e: IncomeEntry): Record<string, unknown> {
  return {
    id: e.id, user_id: e.userId, source: e.source,
    source_name: e.sourceName ?? null, amount: e.amount,
    currency: e.currency, date: e.date,
    is_recurring: e.isRecurring, interval: e.interval ?? null,
    notes: e.notes ?? null, created_at: e.createdAt,
  };
}
