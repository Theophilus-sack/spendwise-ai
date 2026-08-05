import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { dbGetGoals, dbUpsertGoal, dbDeleteGoal, dbGetQueuedIdsByOperation } from '@/lib/database';
import { writeAndSync } from '@/lib/syncEngine';
import { mergeSyncedRows } from '@spendwise/shared';
import type { Goal } from '@spendwise/shared';
import { goalRowSchema, parseRows } from '@/lib/schemas';

interface GoalState {
  goals:   Goal[];
  loading: boolean;
  load:         (userId: string) => Promise<void>;
  addGoal:      (goal: Goal) => Promise<void>;
  updateGoal:   (goal: Goal) => Promise<void>;
  deleteGoal:   (id: string) => Promise<void>;
  contributeToGoal: (goalId: string, amount: number) => Promise<void>;
  reset:        () => void;
}

export const useGoalStore = create<GoalState>((set, get) => ({
  goals:   [],
  loading: false,

  load: async (userId) => {
    set({ loading: true });
    try {
      const local = await dbGetGoals(userId);
      set({ goals: local });

      const { data } = await supabase.from('goals').select('*').eq('user_id', userId);
      if (!data) return;

      const mapped = parseRows(goalRowSchema, data, 'goals');
      const { upsertIds, deleteIds } = await dbGetQueuedIdsByOperation('goals');

      for (const g of mapped) {
        if (!upsertIds.has(g.id) && !deleteIds.has(g.id)) await dbUpsertGoal(g);
      }

      set({ goals: mergeSyncedRows(mapped, local, upsertIds, deleteIds) });
    } finally {
      set({ loading: false });
    }
  },

  addGoal: async (goal) => {
    await dbUpsertGoal(goal);
    set(s => ({ goals: [goal, ...s.goals] }));
    await writeAndSync('goals', goal.id, 'upsert', goalToRemote(goal));
  },

  updateGoal: async (goal) => {
    await dbUpsertGoal(goal);
    set(s => ({ goals: s.goals.map(g => g.id === goal.id ? goal : g) }));
    await writeAndSync('goals', goal.id, 'upsert', goalToRemote(goal));
  },

  deleteGoal: async (id) => {
    await dbDeleteGoal(id);
    set(s => ({ goals: s.goals.filter(g => g.id !== id) }));
    await writeAndSync('goals', id, 'delete', null);
  },

  contributeToGoal: async (goalId, amount) => {
    const goal = get().goals.find(g => g.id === goalId);
    if (!goal) return;
    const updated: Goal = {
      ...goal,
      currentAmount: goal.currentAmount + amount,
      status: goal.currentAmount + amount >= goal.targetAmount ? 'completed' : 'active',
      updatedAt: new Date().toISOString(),
    };
    await get().updateGoal(updated);
  },

  reset: () => set({ goals: [], loading: false }),
}));

function goalToRemote(g: Goal): Record<string, unknown> {
  return {
    id: g.id, user_id: g.userId, title: g.title, emoji: g.emoji,
    target_amount: g.targetAmount, current_amount: g.currentAmount,
    deadline: g.deadline ?? null, priority: g.priority,
    ai_weekly_target: g.aiWeeklyTarget ?? null,
    roundup_enabled: g.roundupEnabled, status: g.status,
    created_at: g.createdAt, updated_at: g.updatedAt,
  };
}
