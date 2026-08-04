import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

/** One-off connectivity check — used by the sync engine to decide whether to
 *  even attempt a Supabase call before spending a network round-trip on a
 *  request that's certain to fail. `isConnected` can be null immediately
 *  after launch before NetInfo has resolved a first reading; treat that as
 *  "assume connected" so a cold-start write isn't needlessly queued. */
export async function isCurrentlyConnected(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return state.isConnected !== false;
}

/** React hook for UI that wants to reflect connectivity live (not currently
 *  used by any screen yet, but this is the one place that should own the
 *  subscription if/when one does, rather than screens each rolling their own). */
export function useIsConnected(): boolean {
  const [connected, setConnected] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setConnected(state.isConnected !== false);
    });
    return unsubscribe;
  }, []);

  return connected;
}

/** Subscribes to connectivity transitions specifically to trigger a queue
 *  flush the moment the device comes back online — not for UI state. */
export function onReconnect(callback: () => void): () => void {
  let wasConnected = true;
  return NetInfo.addEventListener(state => {
    const isConnected = state.isConnected !== false;
    if (isConnected && !wasConnected) callback();
    wasConnected = isConnected;
  });
}
