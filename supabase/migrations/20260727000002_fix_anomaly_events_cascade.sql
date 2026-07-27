-- anomaly_events.expense_id had no ON DELETE clause, so it defaulted to NO ACTION:
-- deleting an expense that had a logged anomaly event failed with a foreign-key
-- violation. The app already removes the local copy and updates UI state before
-- checking the remote delete's result, so that failure was invisible — the
-- "deleted" expense would simply reappear on the next sync. An anomaly event
-- only makes sense in reference to the specific expense it flagged, so it
-- should be removed along with it.

ALTER TABLE public.anomaly_events
  DROP CONSTRAINT IF EXISTS anomaly_events_expense_id_fkey,
  ADD CONSTRAINT anomaly_events_expense_id_fkey
    FOREIGN KEY (expense_id) REFERENCES public.expenses(id) ON DELETE CASCADE;
