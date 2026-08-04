import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { dbGetDebts, dbUpsertDebt, dbDeleteDebt, dbInsertDebtPayment } from '@/lib/database';
import { generateUUID } from '@spendwise/shared';
import type { Debt, DebtPayment } from '@spendwise/shared';

interface DebtState {
  debts:   Debt[];
  loading: boolean;

  load:          (userId: string) => Promise<void>;
  addDebt:       (debt: Debt) => Promise<void>;
  updateDebt:    (debt: Debt) => Promise<void>;
  deleteDebt:    (id: string) => Promise<void>;
  recordPayment: (debtId: string, amount: number, date: string, notes?: string) => Promise<void>;
  reset:         () => void;
}

export const useDebtStore = create<DebtState>((set, get) => ({
  debts:   [],
  loading: false,

  load: async (userId) => {
    set({ loading: true });
    try {
      const local = await dbGetDebts(userId);
      set({ debts: local });
      const { data } = await supabase.from('debts').select('*').eq('user_id', userId);
      if (data) {
        const mapped = data.map(remoteToDebt);
        for (const d of mapped) await dbUpsertDebt(d);
        set({ debts: mapped });
      }
    } finally {
      set({ loading: false });
    }
  },

  addDebt: async (debt) => {
    await dbUpsertDebt(debt);
    set(s => ({ debts: [debt, ...s.debts] }));
    const { error } = await supabase.from('debts').upsert(debtToRemote(debt));
    if (error) throw error;
  },

  updateDebt: async (debt) => {
    await dbUpsertDebt(debt);
    set(s => ({ debts: s.debts.map(d => d.id === debt.id ? debt : d) }));
    const { error } = await supabase.from('debts').upsert(debtToRemote(debt));
    if (error) throw error;
  },

  deleteDebt: async (id) => {
    await dbDeleteDebt(id);
    set(s => ({ debts: s.debts.filter(d => d.id !== id) }));
    await supabase.from('debts').delete().eq('id', id);
  },

  recordPayment: async (debtId, amount, date, notes) => {
    const debt = get().debts.find(d => d.id === debtId);
    if (!debt) return;

    const now = new Date().toISOString();
    const payment: DebtPayment = {
      id: generateUUID(),
      debtId, userId: debt.userId, amount, date, notes, createdAt: now,
    };
    await dbInsertDebtPayment(payment);
    const { error } = await supabase.from('debt_payments').upsert({
      id: payment.id, debt_id: debtId, user_id: debt.userId,
      amount, date, notes: notes ?? null, created_at: now,
    });
    if (error) throw error;

    // A payment can't put the balance below zero, and clearing it to zero
    // is what actually marks the debt paid off.
    const newBalance = Math.max(0, debt.currentBalance - amount);
    await get().updateDebt({
      ...debt,
      currentBalance: newBalance,
      status: newBalance === 0 ? 'paid' : 'active',
      updatedAt: now,
    });
  },

  reset: () => set({ debts: [], loading: false }),
}));

function remoteToDebt(r: Record<string, unknown>): Debt {
  return {
    id: String(r.id), userId: String(r.user_id),
    label: String(r.label), debtType: r.debt_type as any,
    principalAmount: Number(r.principal_amount), currentBalance: Number(r.current_balance),
    interestRatePct: Number(r.interest_rate_pct ?? 0),
    minPayment: r.min_payment != null ? Number(r.min_payment) : undefined,
    dueDayOfMonth: r.due_day_of_month != null ? Number(r.due_day_of_month) : undefined,
    lenderName: r.lender_name ? String(r.lender_name) : undefined,
    startDate: r.start_date ? String(r.start_date) : undefined,
    endDate: r.end_date ? String(r.end_date) : undefined,
    status: r.status as any,
    notes: r.notes ? String(r.notes) : undefined,
    createdAt: String(r.created_at), updatedAt: String(r.updated_at),
  };
}

function debtToRemote(d: Debt): Record<string, unknown> {
  return {
    id: d.id, user_id: d.userId, label: d.label, debt_type: d.debtType,
    principal_amount: d.principalAmount, current_balance: d.currentBalance,
    interest_rate_pct: d.interestRatePct, min_payment: d.minPayment ?? null,
    due_day_of_month: d.dueDayOfMonth ?? null, lender_name: d.lenderName ?? null,
    start_date: d.startDate ?? null, end_date: d.endDate ?? null,
    status: d.status, notes: d.notes ?? null,
    created_at: d.createdAt, updated_at: d.updatedAt,
  };
}
