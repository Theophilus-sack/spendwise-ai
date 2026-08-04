import { isNetworkError } from '@spendwise/shared';
import { supabase } from './supabase';
import { isCurrentlyConnected, onReconnect } from './connectivity';
import {
  dbEnqueueSync, dbGetQueue, dbRemoveFromQueue, dbBumpQueueAttempt, dbGetQueueCount,
} from './database';

/**
 * The single place every store routes a Supabase write through instead of
 * calling `supabase.from(...).upsert()`/`.delete()` inline. Behavior:
 *
 * - Online, succeeds: identical to today — resolves, nothing queued.
 * - Online, real rejection (validation, RLS, conflict): throws, same as
 *   today — the Alert-based error handling already wired into every store's
 *   screen keeps working unchanged.
 * - Offline, or the request fails in a way that looks like a network problem:
 *   silently enqueues instead of throwing. The write already happened to
 *   local SQLite before this is ever called (every store does that first),
 *   so nothing is lost — it just hasn't reached the server yet.
 *
 * `tableName` doubles as the real Supabase table name; `payload` must be the
 * already-fully-mapped remote-shape row (i.e. exactly what would have been
 * passed to `.upsert()` directly) for an upsert, or null for a delete.
 *
 * Returns `{ synced: true }` only when the write actually reached the server
 * just now — callers that need to trigger dependent server-side work (e.g.
 * expenseStore firing `detect-anomaly`/`check-budget-alert`, which read the
 * expense back out of the `expenses` table) should gate that on `synced`,
 * since queuing-for-later means the server doesn't have the row yet.
 */
export async function writeAndSync(
  tableName: string,
  recordId: string,
  operation: 'upsert' | 'delete',
  payload: Record<string, unknown> | null,
): Promise<{ synced: boolean }> {
  if (!(await isCurrentlyConnected())) {
    await dbEnqueueSync(tableName, recordId, operation, payload);
    return { synced: false };
  }

  try {
    const { error } =
      operation === 'upsert'
        ? await supabase.from(tableName).upsert(payload as Record<string, unknown>)
        : await supabase.from(tableName).delete().eq('id', recordId);

    if (!error) {
      await dbRemoveFromQueue(tableName, recordId);
      return { synced: true };
    }
    if (isNetworkError(error)) {
      await dbEnqueueSync(tableName, recordId, operation, payload);
      return { synced: false };
    }
    throw error;
  } catch (err) {
    if (isNetworkError(err)) {
      await dbEnqueueSync(tableName, recordId, operation, payload);
      return { synced: false };
    }
    throw err;
  }
}

let flushing = false;

/** Retries every queued write. Safe to call opportunistically and often —
 *  reconnect, foreground, app launch — since it no-ops immediately if the
 *  queue is empty or a flush is already in progress. */
export async function flushQueue(): Promise<void> {
  if (flushing) return;
  if (!(await isCurrentlyConnected())) return;

  flushing = true;
  try {
    const items = await dbGetQueue();
    for (const item of items) {
      try {
        const { error } =
          item.operation === 'upsert'
            ? await supabase.from(item.tableName).upsert(item.payload as Record<string, unknown>)
            : await supabase.from(item.tableName).delete().eq('id', item.recordId);

        if (!error) {
          await dbRemoveFromQueue(item.tableName, item.recordId);
        } else if (!isNetworkError(error)) {
          // A real rejection (not a connectivity problem) — retrying the
          // identical request again next flush won't help, but it's left
          // queued rather than silently dropped so it stays visible via the
          // pending-sync count and `last_error` for the user/developer to see.
          await dbBumpQueueAttempt(item.tableName, item.recordId, error.message ?? String(error));
        }
        // A network-shaped error mid-flush: leave it queued, no attempt bump —
        // connectivity dropped again, this isn't a real failure worth recording.
      } catch (err) {
        if (!isNetworkError(err)) {
          await dbBumpQueueAttempt(item.tableName, item.recordId, err instanceof Error ? err.message : String(err));
        }
      }
    }
  } finally {
    flushing = false;
  }
}

export async function getPendingSyncCount(): Promise<number> {
  return dbGetQueueCount();
}

/** Wires the two passive triggers (reconnect, and whatever the caller treats
 *  as "app came back to the foreground") to opportunistically flush. Call
 *  once near the app root; returns an unsubscribe function. */
export function startSyncListeners(): () => void {
  const unsubscribeReconnect = onReconnect(() => { flushQueue(); });
  return () => unsubscribeReconnect();
}
