import { create } from 'zustand';
import { supabase, callEdgeFunction } from '@/lib/supabase';
import { startOfWeekISO, scoreToGrade } from '@spendwise/shared';
import type { FDSComponents, FDSResult } from '@spendwise/shared';

interface DisciplineState {
  score:      number | null;
  grade:      FDSResult['grade'] | null;
  trend:      FDSResult['trend'] | null;
  components: FDSComponents | null;
  commentary: string | null;
  weekStart:  string | null;
  loading:    boolean;
  error:      string | null;

  load:  (userId: string) => Promise<void>;
  reset: () => void;
}

export const useDisciplineStore = create<DisciplineState>((set) => ({
  score:      null,
  grade:      null,
  trend:      null,
  components: null,
  commentary: null,
  weekStart:  null,
  loading:    false,
  error:      null,

  load: async (userId) => {
    set({ loading: true, error: null });
    const weekStart = startOfWeekISO();

    try {
      const { data, error: fetchError } = await supabase
        .from('discipline_scores')
        .select('week_start,score,budget_adherence,savings_rate,consistency,improvement_trend,ai_commentary')
        .eq('user_id', userId)
        .order('week_start', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fetchError) throw fetchError;

      // A score already exists for the current week — use it, no need to recompute.
      if (data && data.week_start === weekStart) {
        const score = Number(data.score);
        set({
          score,
          grade: scoreToGrade(score),
          components: {
            budgetAdherence: Number(data.budget_adherence ?? 0),
            savingsRate:     Number(data.savings_rate ?? 0),
            consistency:     Number(data.consistency ?? 0),
            improvement:     Number(data.improvement_trend ?? 0),
          },
          commentary: data.ai_commentary ?? null,
          trend: null, // not stored on the row itself — only known right when it's freshly computed
          weekStart,
          loading: false,
        });
        return;
      }

      // No score yet for this week (new user, or the first visit of a new week) — compute one now.
      const fresh = await callEdgeFunction<{
        score: number;
        grade: FDSResult['grade'];
        trend: FDSResult['trend'];
        commentary: string;
        components: FDSComponents;
      }>('compute-fds', { weekStart });

      set({
        score:      fresh.score,
        grade:      fresh.grade,
        trend:      fresh.trend,
        components: fresh.components,
        commentary: fresh.commentary,
        weekStart,
        loading:    false,
      });
    } catch (err) {
      // Leave score/grade as null rather than showing a fabricated value —
      // the screen renders an honest "couldn't load" state for this case.
      set({
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load discipline score',
      });
    }
  },

  reset: () => set({
    score: null, grade: null, trend: null, components: null, commentary: null,
    weekStart: null, loading: false, error: null,
  }),
}));
