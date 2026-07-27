export class RateLimitError extends Error {}

/**
 * Throws RateLimitError once a user exceeds `limit` calls to `fnName` within
 * `windowSeconds`. Backed by the `check_rate_limit` Postgres function so the
 * count is shared and atomic across edge function instances.
 */
export async function enforceRateLimit(
  supabase: any,
  userId: string,
  fnName: string,
  limit: number,
  windowSeconds: number,
): Promise<void> {
  const { data: allowed, error } = await supabase.rpc('check_rate_limit', {
    p_user_id: userId,
    p_fn_name: fnName,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });

  // Fail open on an infrastructure error (e.g. migration not yet applied) rather
  // than taking the feature down — this is an abuse guard, not a correctness gate.
  if (error) return;

  if (!allowed) {
    throw new RateLimitError(`Too many requests — please wait a bit before trying again.`);
  }
}
