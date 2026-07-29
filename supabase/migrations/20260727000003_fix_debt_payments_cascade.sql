-- debt_payments.user_id had no ON DELETE clause, unlike every other user-owned
-- table's FK to auth.users. That's inert on its own, but it becomes a real bug
-- the moment account deletion is implemented: deleting a user with any debt
-- payment history would fail with a foreign-key violation instead of cleanly
-- cascading, since debt_payments would be the one table left behind.

ALTER TABLE public.debt_payments
  DROP CONSTRAINT IF EXISTS debt_payments_user_id_fkey,
  ADD CONSTRAINT debt_payments_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
