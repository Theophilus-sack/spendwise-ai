import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { dbClearAll } from '@/lib/database';
import { resetAllUserStores } from './resetStores';
import type { UserProfile } from '@spendwise/shared';

interface AuthState {
  session:  Session | null;
  user:     User | null;
  profile:  UserProfile | null;
  loading:  boolean;

  setSession:  (session: Session | null) => void;
  setProfile:  (profile: UserProfile | null) => void;
  signOut:     () => Promise<void>;
  fetchProfile: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session:  null,
  user:     null,
  profile:  null,
  loading:  true,

  setSession: (session) => {
    const newUserId  = session?.user?.id ?? null;
    const prevUserId = get().user?.id ?? null;

    // Defense in depth: if the active session's user id ever changes without
    // going through signOut() (e.g. an unexpected token/session swap), wipe
    // every per-user store rather than letting the previous account's data
    // render under the new session for however long a fresh load takes.
    if (prevUserId && newUserId && prevUserId !== newUserId) {
      resetAllUserStores();
    }

    set({ session, user: session?.user ?? null, loading: false });
  },

  setProfile: (profile) => set({ profile }),

  signOut: async () => {
    await supabase.auth.signOut();
    resetAllUserStores();
    await dbClearAll();
    set({ session: null, user: null, profile: null });
  },

  fetchProfile: async () => {
    const { user } = get();
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();
    if (data) {
      set({
        profile: {
          id:                    data.id,
          userId:                data.user_id,
          fullName:              data.full_name,
          phoneNumber:           data.phone_number,
          currency:              data.currency ?? 'GHS',
          monthlyIncome:         data.monthly_income ?? 0,
          incomeSources:         data.income_sources ?? [],
          spendingPersonality:   data.spending_personality,
          financialGoals:        data.onboarding_goals ?? [],
          preferredCategories:   data.preferred_categories ?? [],
          preferredPaymentMethods: data.preferred_payment_methods ?? [],
          savingsTargetPct:      data.savings_target_pct ?? 20,
          disciplineStyle:       data.discipline_style ?? 'flexible',
          onboardingCompleted:   data.onboarding_completed ?? false,
          createdAt:             data.created_at,
          updatedAt:             data.updated_at,
        },
      });
    }
  },
}));
