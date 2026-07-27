-- Per-user, per-function request counters for the Claude-backed edge functions.
-- Edge function instances are stateless/ephemeral, so rate limiting has to live
-- in the database rather than in-memory.

CREATE TABLE IF NOT EXISTS public.api_rate_limits (
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fn_name      TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  call_count   INT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, fn_name)
);

ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;
-- Intentionally no client-facing policy: this table is only ever touched by
-- edge functions via the service-role client (through check_rate_limit below),
-- never read or written directly by the app.

-- Atomically checks and increments a user's call count for a fixed window,
-- resetting the window once it expires. Runs as a single UPSERT so concurrent
-- requests from the same user can't race past the limit.
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_user_id       UUID,
  p_fn_name       TEXT,
  p_limit         INT,
  p_window_seconds INT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
BEGIN
  INSERT INTO public.api_rate_limits (user_id, fn_name, window_start, call_count)
  VALUES (p_user_id, p_fn_name, now(), 1)
  ON CONFLICT (user_id, fn_name) DO UPDATE
    SET call_count = CASE
          WHEN public.api_rate_limits.window_start < now() - (p_window_seconds || ' seconds')::interval
            THEN 1
          ELSE public.api_rate_limits.call_count + 1
        END,
        window_start = CASE
          WHEN public.api_rate_limits.window_start < now() - (p_window_seconds || ' seconds')::interval
            THEN now()
          ELSE public.api_rate_limits.window_start
        END
  RETURNING call_count INTO v_count;

  RETURN v_count <= p_limit;
END;
$$;
