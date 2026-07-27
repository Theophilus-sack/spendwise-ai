import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { dbGetIncome, dbUpsertIncome } from '@/lib/database';
import type { IncomeEntry } from '@spendwise/shared';

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
      if (data) {
        const mapped = data.map(remoteToIncome);
        for (const e of mapped) await dbUpsertIncome(e);
        set({ entries: mapped });
      }
    } finally {
      set({ loading: false });
    }
  },

  addEntry: async (entry) => {
    await dbUpsertIncome(entry);
    set(s => ({ entries: [entry, ...s.entries] }));
    await supabase.from('income_entries').upsert(incomeToRemote(entry));
  },

  deleteEntry: async (id) => {
    set(s => ({ entries: s.entries.filter(e => e.id !== id) }));
    await supabase.from('income_entries').delete().eq('id', id);
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

function remoteToIncome(r: Record<string, unknown>): IncomeEntry {
  return {
    id: String(r.id), userId: String(r.user_id),
    source: String(r.source) as IncomeEntry['source'],
    sourceName: r.source_name ? String(r.source_name) : undefined,
    amount: Number(r.amount), currency: String(r.currency ?? 'GHS') as any,
    date: String(r.date), isRecurring: Boolean(r.is_recurring),
    interval: r.interval ? String(r.interval) as any : undefined,
    notes: r.notes ? String(r.notes) : undefined,
    createdAt: String(r.created_at),
  };
}

function incomeToRemote(e: IncomeEntry): Record<string, unknown> {
  return {
    id: e.id, user_id: e.userId, source: e.source,
    source_name: e.sourceName ?? null, amount: e.amount,
    currency: e.currency, date: e.date,
    is_recurring: e.isRecurring, interval: e.interval ?? null,
    notes: e.notes ?? null, created_at: e.createdAt,
  };
}
