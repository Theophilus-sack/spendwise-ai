import { create } from 'zustand';
import { supabase, callEdgeFunction } from '@/lib/supabase';
import { startOfWeekISO } from '@spendwise/shared';

export type FollowThrough = 'yes' | 'partially' | 'no';

export interface WeeklyReflection {
  id: string;
  weekStart: string;
  exceededCategory: string | null;
  adjustNextWeek: boolean;
  smallChange: string;
  moodRating: number;
  aiResponse: string | null;
  followThrough: FollowThrough | null;
  createdAt: string;
}

export interface SubmitReflectionInput {
  exceededCategory: string | null;
  adjustNextWeek: boolean;
  smallChange: string;
  moodRating: number;
  followThrough?: FollowThrough;
}

export interface SubmitReflectionResult {
  score: number;
  grade: string;
  reflectionBonus: number;
  aiResponse: string;
}

interface WeeklyReflectionState {
  current:    WeeklyReflection | null;
  previous:   WeeklyReflection | null;
  streak:     number;
  loading:    boolean;
  submitting: boolean;

  load:   (userId: string) => Promise<void>;
  submit: (userId: string, input: SubmitReflectionInput) => Promise<SubmitReflectionResult>;
  reset:  () => void;
}

export const useWeeklyReflectionStore = create<WeeklyReflectionState>((set, get) => ({
  current:    null,
  previous:   null,
  streak:     0,
  loading:    false,
  submitting: false,

  load: async (userId) => {
    set({ loading: true });
    try {
      const { data } = await supabase
        .from('weekly_reflections')
        .select('*')
        .eq('user_id', userId)
        .order('week_start', { ascending: false })
        .limit(12);

      const reflections = (data ?? []).map(remoteToReflection);
      const thisWeek = startOfWeekISO();
      const lastWeek = shiftDate(thisWeek, -7);

      set({
        current:  reflections.find(r => r.weekStart === thisWeek) ?? null,
        previous: reflections.find(r => r.weekStart === lastWeek) ?? null,
        streak:   computeReflectionStreak(reflections.map(r => r.weekStart)),
      });
    } finally {
      set({ loading: false });
    }
  },

  submit: async (userId, input) => {
    set({ submitting: true });
    try {
      const weekStart = startOfWeekISO();
      const result = await callEdgeFunction<SubmitReflectionResult>('weekly-reflection', {
        weekStart, ...input,
      });
      await get().load(userId);
      return result;
    } finally {
      set({ submitting: false });
    }
  },

  reset: () => set({ current: null, previous: null, streak: 0, loading: false, submitting: false }),
}));

function remoteToReflection(r: Record<string, unknown>): WeeklyReflection {
  return {
    id: String(r.id),
    weekStart: String(r.week_start),
    exceededCategory: r.exceeded_category ? String(r.exceeded_category) : null,
    adjustNextWeek: Boolean(r.adjust_next_week),
    smallChange: String(r.small_change ?? ''),
    moodRating: Number(r.mood_rating ?? 3),
    aiResponse: r.ai_response ? String(r.ai_response) : null,
    followThrough: (r.follow_through as FollowThrough) ?? null,
    createdAt: String(r.created_at),
  };
}

/** Consecutive weekly reflections, counting back from the most recent one —
 *  which must be this week's or last week's, otherwise the streak is broken
 *  (matches the same grace-period logic as the logging streak in badges.ts). */
function computeReflectionStreak(weekStartsDesc: string[]): number {
  if (weekStartsDesc.length === 0) return 0;

  const thisWeek = startOfWeekISO();
  const lastWeek = shiftDate(thisWeek, -7);
  if (weekStartsDesc[0] !== thisWeek && weekStartsDesc[0] !== lastWeek) return 0;

  let streak = 1;
  let expected = shiftDate(weekStartsDesc[0], -7);
  for (let i = 1; i < weekStartsDesc.length; i++) {
    if (weekStartsDesc[i] === expected) {
      streak++;
      expected = shiftDate(expected, -7);
    } else {
      break;
    }
  }
  return streak;
}

function shiftDate(iso: string, deltaDays: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + deltaDays);
  return d.toISOString().split('T')[0];
}
