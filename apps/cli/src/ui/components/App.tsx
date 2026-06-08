import { Box } from 'ink';
import { useCallback, useRef } from 'react';
import { useStoreSelector } from '../hooks.js';
import type { Store } from '../store.js';
import { ApprovalPrompt } from './ApprovalPrompt.js';
import { Header } from './Header.js';
import { PhaseTree } from './PhaseTree.js';
import { RagInfo } from './RagInfo.js';
import { ResultSummary } from './ResultSummary.js';
import { StreamView } from './StreamView.js';

export interface AppProps {
  store: Store;
  /** External stream-token emitter; kept outside the store (Tier 2). */
  streamTokenEmitter: {
    subscribe: (cb: (token: string) => void) => () => void;
  };
}

export function App({ store, streamTokenEmitter }: AppProps) {
  const hasActiveStep = useStoreSelector(store, (s) => s.currentStepId !== null);
  const status = useStoreSelector(store, (s) => s.status);

  const subscribeRef = useRef(streamTokenEmitter.subscribe);
  subscribeRef.current = streamTokenEmitter.subscribe;

  const stableSubscribe = useCallback(
    (cb: (token: string) => void) => subscribeRef.current(cb),
    [],
  );

  const showStream = hasActiveStep && status === 'executing';

  return (
    <Box flexDirection="column">
      <Header store={store} />
      <RagInfo store={store} />
      <PhaseTree store={store} />
      <StreamView subscribe={stableSubscribe} active={showStream} />
      <ApprovalPrompt store={store} />
      <ResultSummary store={store} />
    </Box>
  );
}
