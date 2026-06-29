-- ═══════════════════════════════════════════════════════════════════════════
-- SpendWise AI — Initial Database Schema
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Profiles ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.profiles (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name                 TEXT NOT NULL DEFAULT '',
  phone_number              TEXT,
  currency                  TEXT NOT NULL DEFAULT 'GHS',
  monthly_income            NUMERIC(14,2) DEFAULT 0,
  income_sources            TEXT[] DEFAULT '{}',
  spending_personality      TEXT CHECK (spending_personality IN ('saver','balanced','spender')),
  onboarding_goals          TEXT[] DEFAULT '{}',
  preferred_categories      TEXT[] DEFAULT '{}',
  preferred_payment_methods TEXT[] DEFAULT '{}',
  savings_target_pct        NUMERIC(5,2) DEFAULT 20,
  discipline_style          TEXT DEFAULT 'flexible' CHECK (discipline_style IN ('strict','flexible')),
  onboarding_completed      BOOLEAN DEFAULT false,
  created_at                TIMESTAMPTZ DEFAULT now(),
  updated_at                TIMESTAMPTZ DEFAULT now()
);

-- ─── Expenses ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.expenses (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount            NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  currency          TEXT NOT NULL DEFAULT 'GHS',
  category          TEXT NOT NULL,
  subcategory       TEXT,
  merchant_name     TEXT,
  payment_method    TEXT NOT NULL,
  mobile_money_type TEXT,
  description       TEXT,
  notes             TEXT,
  date              DATE NOT NULL,
  time_of_day       TIME,
  is_recurring      BOOLEAN DEFAULT false,
  recurring_interval TEXT CHECK (recurring_interval IN ('daily','weekly','monthly')),
  receipt_image_url TEXT,
  is_split          BOOLEAN DEFAULT false,
  split_total       NUMERIC(14,2),
  split_count       INT,
  roundup_amount    NUMERIC(14,2) DEFAULT 0,
  ai_categorized    BOOLEAN DEFAULT false,
  ai_confidence     NUMERIC(5,4),
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expenses_user_date     ON public.expenses(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_user_category ON public.expenses(user_id, category);
CREATE INDEX IF NOT EXISTS idx_expenses_user_month ON public.expenses(user_id, date_trunc('month', date::timestamp));
-- ─── Income ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.income_entries (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source       TEXT NOT NULL,
  source_name  TEXT,
  amount       NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  currency     TEXT NOT NULL DEFAULT 'GHS',
  date         DATE NOT NULL,
  is_recurring BOOLEAN DEFAULT false,
  interval     TEXT,
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_income_user_date ON public.income_entries(user_id, date DESC);

-- ─── Budgets ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.budgets (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category     TEXT NOT NULL,
  limit_amount NUMERIC(14,2) NOT NULL CHECK (limit_amount > 0),
  period       TEXT NOT NULL DEFAULT 'monthly' CHECK (period IN ('weekly','monthly','yearly')),
  rollover     BOOLEAN DEFAULT false,
  ai_suggested BOOLEAN DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, category, period)
);

-- ─── Goals ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.goals (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  emoji            TEXT DEFAULT '🎯',
  target_amount    NUMERIC(14,2) NOT NULL CHECK (target_amount > 0),
  current_amount   NUMERIC(14,2) DEFAULT 0,
  deadline         DATE,
  priority         INT DEFAULT 1,
  ai_weekly_target NUMERIC(14,2),
  roundup_enabled  BOOLEAN DEFAULT false,
  status           TEXT DEFAULT 'active' CHECK (status IN ('active','completed','paused')),
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

-- ─── Debts ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.debts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label             TEXT NOT NULL,
  debt_type         TEXT NOT NULL CHECK (debt_type IN ('loan','credit_card','owed_to_me','i_owe')),
  principal_amount  NUMERIC(14,2) NOT NULL,
  current_balance   NUMERIC(14,2) NOT NULL,
  interest_rate_pct NUMERIC(6,3) DEFAULT 0,
  min_payment       NUMERIC(14,2),
  due_day_of_month  INT,
  lender_name       TEXT,
  start_date        DATE,
  end_date          DATE,
  status            TEXT DEFAULT 'active' CHECK (status IN ('active','paid')),
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.debt_payments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debt_id    UUID NOT NULL REFERENCES public.debts(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id),
  amount     NUMERIC(14,2) NOT NULL,
  date       DATE NOT NULL,
  notes      TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── AI Conversations ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  messages         JSONB NOT NULL DEFAULT '[]',
  context_snapshot JSONB,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_feedback (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recommendation_id TEXT NOT NULL,
  feedback_type     TEXT CHECK (feedback_type IN ('helpful','already_doing','not_relevant')),
  created_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, recommendation_id)
);

-- ─── Anomaly Events ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.anomaly_events (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expense_id         UUID REFERENCES public.expenses(id),
  category           TEXT NOT NULL,
  transaction_amount NUMERIC(14,2),
  category_median    NUMERIC(14,2),
  category_mad       NUMERIC(14,2),
  modified_z_score   NUMERIC(8,4),
  acknowledged       BOOLEAN DEFAULT false,
  created_at         TIMESTAMPTZ DEFAULT now()
);

-- ─── Financial Discipline Score ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.discipline_scores (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start        DATE NOT NULL,
  score             NUMERIC(5,2) NOT NULL,
  budget_adherence  NUMERIC(5,4),
  savings_rate      NUMERIC(5,4),
  consistency       NUMERIC(5,4),
  improvement_trend NUMERIC(5,4),
  ai_commentary     TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, week_start)
);

-- ─── Streaks & Badges ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.streaks (
  user_id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  current_streak   INT DEFAULT 0,
  longest_streak   INT DEFAULT 0,
  last_active_date DATE,
  updated_at       TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.badges (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT NOT NULL,
  emoji       TEXT NOT NULL,
  category    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.user_badges (
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id    TEXT NOT NULL REFERENCES public.badges(id),
  unlocked_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, badge_id)
);

-- ─── Weekly Reflections ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.weekly_reflections (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start        DATE NOT NULL,
  exceeded_category TEXT,
  adjust_next_week  BOOLEAN DEFAULT false,
  small_change      TEXT,
  mood_rating       INT CHECK (mood_rating BETWEEN 1 AND 5),
  ai_response       TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, week_start)
);

-- ─── Notifications ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.notification_log (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type    TEXT NOT NULL,
  title   TEXT NOT NULL,
  body    TEXT NOT NULL,
  data    JSONB,
  sent_at TIMESTAMPTZ DEFAULT now(),
  read_at TIMESTAMPTZ
);

-- ═══════════════════════════════════════════════════════════════════════════
-- Row Level Security
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.income_entries     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debt_payments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_conversations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_feedback        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anomaly_events     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discipline_scores  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.streaks            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_reflections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_log   ENABLE ROW LEVEL SECURITY;

-- Helper function
CREATE OR REPLACE FUNCTION is_own_record(uid UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER AS $$
  SELECT auth.uid() = uid
$$;

-- Apply policies
DO $$
DECLARE
  tbl TEXT;
  col TEXT;
BEGIN
  FOR tbl, col IN VALUES
    ('profiles',           'user_id'),
    ('expenses',           'user_id'),
    ('income_entries',     'user_id'),
    ('budgets',            'user_id'),
    ('goals',              'user_id'),
    ('debts',              'user_id'),
    ('debt_payments',      'user_id'),
    ('ai_conversations',   'user_id'),
    ('ai_feedback',        'user_id'),
    ('anomaly_events',     'user_id'),
    ('discipline_scores',  'user_id'),
    ('streaks',            'user_id'),
    ('user_badges',        'user_id'),
    ('weekly_reflections', 'user_id'),
    ('notification_log',   'user_id')
  LOOP
    EXECUTE format(
      'CREATE POLICY "own_%s" ON public.%I FOR ALL USING (auth.uid() = %I) WITH CHECK (auth.uid() = %I)',
      tbl, tbl, col, col
    );
  END LOOP;
END $$;

-- Badges are public read
CREATE POLICY "badges_public_read" ON public.badges FOR SELECT USING (true);

-- ═══════════════════════════════════════════════════════════════════════════
-- Seed badge definitions
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO public.badges (id, name, description, emoji, category) VALUES
  ('first_expense',   'First Step',      'Logged your first expense',              '👣', 'milestone'),
  ('first_income',    'Earner',          'Added your first income source',          '💼', 'milestone'),
  ('first_budget',    'Planner',         'Created your first budget',               '📋', 'budget'),
  ('streak_3',        'On Fire',         '3-day logging streak',                    '🔥', 'consistency'),
  ('streak_7',        'Week Warrior',    '7-day logging streak',                    '⚔️', 'consistency'),
  ('streak_30',       'Money Master',    '30-day logging streak',                   '👑', 'consistency'),
  ('streak_100',      'Legendary',       '100-day logging streak',                  '🏆', 'consistency'),
  ('budget_kept',     'Disciplined',     'Stayed under budget for a full month',    '🎯', 'budget'),
  ('saver',           'Smart Saver',     'Saved more than you spent',               '🐷', 'savings'),
  ('goal_setter',     'Goal Setter',     'Created your first savings goal',         '🎯', 'savings'),
  ('goal_halfway',    'Halfway There',   'Reached 50% of a savings goal',           '🚀', 'savings'),
  ('goal_crusher',    'Goal Crusher',    'Completed a savings goal',                '💪', 'savings'),
  ('debt_slayer',     'Debt Slayer',     'Made your first debt payment',            '⚡', 'milestone'),
  ('discipline_a',    'Grade A',         'Earned an A on your Discipline Score',    '🌟', 'budget'),
  ('no_spend_day',    'No Spend Day',    'Completed a no-spend day',                '🧊', 'behaviour'),
  ('early_bird',      'Early Bird',      'Logged an expense before 8am',            '🌅', 'behaviour'),
  ('analyzer',        'Analyzer',        'Viewed your analytics for the first time','🔍', 'milestone'),
  ('receipt_scanner', 'Scanner',         'Scanned your first receipt',              '📸', 'milestone'),
  ('ai_user',         'AI Explorer',     'Had your first AI advisor conversation',  '🤖', 'milestone'),
  ('month_master',    'Month Master',    'Completed a full month of tracking',      '📅', 'consistency')
ON CONFLICT (id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- Auto-create profile on signup
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, currency, onboarding_completed)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'GHS',
    false
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_profiles_updated_at   BEFORE UPDATE ON public.profiles   FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_expenses_updated_at   BEFORE UPDATE ON public.expenses   FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_budgets_updated_at    BEFORE UPDATE ON public.budgets    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_goals_updated_at      BEFORE UPDATE ON public.goals      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
