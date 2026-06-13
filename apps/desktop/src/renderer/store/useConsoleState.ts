import { useEffect, useMemo, useSyncExternalStore } from 'react';
import type { FrontAgentBridge } from '../../ipc/contract.js';
import { type ConsoleStore, createConsoleStore } from './consoleStore.js';

/** React binding over {@link createConsoleStore}. Returns the live state plus the store actions. */
export function useConsoleState(bridge: FrontAgentBridge): {
  state: ReturnType<ConsoleStore['getState']>;
  launching: boolean;
  runTask: ConsoleStore['runTask'];
  respondApproval: ConsoleStore['respondApproval'];
} {
  const store = useMemo(() => createConsoleStore(bridge), [bridge]);
  useEffect(() => () => store.dispose(), [store]);

  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  const launching = useSyncExternalStore(store.subscribe, store.isLaunching, store.isLaunching);

  return { state, launching, runTask: store.runTask, respondApproval: store.respondApproval };
}
