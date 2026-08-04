ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS description TEXT;
