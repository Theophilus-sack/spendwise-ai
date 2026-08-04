import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { dbGetGoals, dbUpsertGoal } from '@/lib/database';
import type { Goal } from '@spendwise/shared';

interface GoalState {
  goals:   Goal[];
  loading: boolean;
  load:         (userId: string) => Promise<void>;
  addGoal:      (goal: Goal) => Promise<void>;
  updateGoal:   (goal: Goal) => Promise<void>;
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
      const { data } = await supabase.from('goals').select('*').eq('user_id', userId).neq('status', 'deleted');
      if (data) {
        const mapped = data.map(remoteToGoal);
        for (const g of mapped) await dbUpsertGoal(g);
        set({ goals: mapped });
      }
    } finally {
      set({ loading: false });
    }
  },

  addGoal: async (goal) => {
    await dbUpsertGoal(goal);
    set(s => ({ goals: [goal, ...s.goals] }));
    const { error } = await supabase.from('goals').upsert(goalToRemote(goal));
    if (error) throw error;
  },

  updateGoal: async (goal) => {
    await dbUpsertGoal(goal);
    set(s => ({ goals: s.goals.map(g => g.id === goal.id ? goal : g) }));
    const { error } = await supabase.from('goals').upsert(goalToRemote(goal));
    if (error) throw error;
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

function remoteToGoal(r: Record<string, unknown>): Goal {
  return {
    id: String(r.id), userId: String(r.user_id),
    title: String(r.title), emoji: String(r.emoji ?? '🎯'),
    targetAmount: Number(r.target_amount), currentAmount: Number(r.current_amount ?? 0),
    deadline: r.deadline ? String(r.deadline) : undefined,
    priority: Number(r.priority ?? 1),
    aiWeeklyTarget: r.ai_weekly_target ? Number(r.ai_weekly_target) : undefined,
    roundupEnabled: Boolean(r.roundup_enabled),
    status: String(r.status ?? 'active') as Goal['status'],
    createdAt: String(r.created_at), updatedAt: String(r.updated_at),
  };
}

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
