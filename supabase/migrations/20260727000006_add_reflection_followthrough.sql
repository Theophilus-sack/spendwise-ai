-- Records whether the user followed through on the *previous* week's stated
-- small_change — asked at the start of the following week's reflection. This
-- is what turns weekly_reflections from a one-off form into a closed loop:
-- each week can reference what was actually committed to last time.
ALTER TABLE public.weekly_reflections
  ADD COLUMN IF NOT EXISTS follow_through TEXT
  CHECK (follow_through IN ('yes', 'partially', 'no'));
