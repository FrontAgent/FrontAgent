import { useSyncExternalStore, useCallback, useRef } from 'react';
import type { Store, AgentUIState } from './store.js';

/**
 * Subscribe to the full store snapshot.
 * Prefer useStoreSelector for targeted reads to avoid unnecessary re-renders.
 */
export function useStore(store: Store): AgentUIState {
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}

/**
 * Subscribe to a stable slice of the store.
 * The selector should return a primitive or a structurally-stable reference.
 */
export function useStoreSelector<T>(
  store: Store,
  selector: (s: AgentUIState) => T,
): T {
  const selectorRef = useRef(selector);
  selectorRef.current = selector;

  const getSnapshot = useCallback(
    () => selectorRef.current(store.getSnapshot()),
    [store],
  );

  return useSyncExternalStore(store.subscribe, getSnapshot);
}
