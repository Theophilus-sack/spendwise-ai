/**
 * Pure decision logic for the offline-sync engine — no SQLite, no Supabase
 * client, no React Native APIs, so it's directly unit-testable with `bun
 * test` (see sync.test.ts), the same split already used for fds.ts/forecast.ts.
 * The I/O side (actually reading/writing the queue, calling Supabase) lives
 * in apps/mobile/src/lib/syncEngine.ts and calls into this.
 */

/**
 * Distinguishes "the request never reached the server" (queue it, retry
 * later, don't bother the user) from "the server rejected it" (a real
 * validation/RLS/conflict error — surface it now, retrying an identical
 * rejected request forever would be pointless). Supabase-js can fail either
 * by rejecting the call outright (a thrown TypeError from the underlying
 * fetch on a real network failure) or by resolving with a populated `error`
 * field — this checks the message either shape produces, since a genuine
 * network failure has no meaningful Postgres error code to key off instead.
 */
export function isNetworkError(err: unknown): boolean {
  if (!err) return false;
  const message = (
    typeof err === 'object' && err !== null && 'message' in err
      ? String((err as { message: unknown }).message)
      : String(err)
  ).toLowerCase();

  return (
    message.includes('network') ||
    message.includes('fetch failed') ||
    message.includes('failed to fetch') ||
    message.includes('timeout') ||
    message.includes('timed out') ||
    message.includes('offline') ||
    message.includes('internet connection') ||
    message.includes('connection reset')
  );
}

/**
 * Merges a freshly-fetched remote row set with what's still queued locally,
 * so `load()` never lets a stale server response overwrite a write the user
 * just made that hasn't reached the server yet (the bug that made offline
 * budget/goal/debt/income edits silently vanish before this rebuild).
 *
 * - Anything with a pending upsert keeps its LOCAL version (the user's latest
 *   un-acknowledged intent), not whatever the server just returned.
 * - Anything with a pending delete is excluded entirely — remote or local —
 *   since it's supposed to be gone regardless of whether the delete has
 *   actually reached the server yet.
 * - Everything else uses the remote version, since remote is authoritative
 *   for anything not currently in flight.
 */
export function mergeSyncedRows<T extends { id: string }>(
  remoteRows: T[],
  localRows: T[],
  pendingUpsertIds: Set<string>,
  pendingDeleteIds: Set<string>,
): T[] {
  const remoteFiltered = remoteRows.filter(
    r => !pendingUpsertIds.has(r.id) && !pendingDeleteIds.has(r.id),
  );
  const preservedLocal = localRows.filter(r => pendingUpsertIds.has(r.id));
  return [...remoteFiltered, ...preservedLocal];
}
