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
  /** True the moment a session was established via a password-recovery link
   *  (Supabase fires a distinct 'PASSWORD_RECOVERY' auth event for this,
   *  rather than 'SIGNED_IN') — the session is real, but RootNavigator must
   *  force the "set a new password" screen before treating the user as
   *  normally logged in, otherwise they'd get silently dropped straight
   *  into the app with the recovery link acting as an unintended login. */
  passwordRecoveryPending: boolean;

  setSession:  (session: Session | null) => void;
  setProfile:  (profile: UserProfile | null) => void;
  setPasswordRecoveryPending: (pending: boolean) => void;
  signOut:     () => Promise<void>;
  fetchProfile: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session:  null,
  user:     null,
  profile:  null,
  loading:  true,
  passwordRecoveryPending: false,

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

  setPasswordRecoveryPending: (pending) => set({ passwordRecoveryPending: pending }),

  signOut: async () => {
    // The remote call can legitimately fail (e.g. the session's account was
    // just deleted server-side) — local cleanup must still happen regardless,
    // otherwise the app is stuck showing a dead session with no way out.
    try {
      await supabase.auth.signOut();
    } catch {
      // ignored — falling through to local cleanup below either way
    }
    resetAllUserStores();
    await dbClearAll();
    set({ session: null, user: null, profile: null, passwordRecoveryPending: false });
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
