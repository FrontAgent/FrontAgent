import { Box, Text } from 'ink';
import type { Store } from '../store.js';
import { useStoreSelector } from '../hooks.js';

interface ResultSummaryProps {
  store: Store;
}

export function ResultSummary({ store }: ResultSummaryProps) {
  const status = useStoreSelector(store, (s) => s.status);
  const result = useStoreSelector(store, (s) => s.result);
  const startTime = useStoreSelector(store, (s) => s.startTime);
  const runLogPath = useStoreSelector(store, (s) => s.runLogPath);

  if (status !== 'done' && status !== 'error') return null;

  const elapsed = result?.duration ?? (Date.now() - startTime);
  const elapsedStr = elapsed > 1000
    ? `${(elapsed / 1000).toFixed(1)}s`
    : `${elapsed}ms`;

  if (status === 'error') {
    return (
      <Box flexDirection="column" marginTop={1}>
        <Text color="red" bold>最终回答</Text>
        <Box paddingLeft={2} marginTop={1}>
          <Text color="red">{result?.error || '任务未能生成最终回答。'}</Text>
        </Box>
        <Text dimColor>⏱ {elapsedStr}</Text>
        {runLogPath ? <Text dimColor>日志: {runLogPath}</Text> : null}
      </Box>
    );
  }

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text color="green" bold>最终回答</Text>
      {result?.output ? (
        <Box paddingLeft={2} marginTop={1}>
          <Text>{String(result.output)}</Text>
        </Box>
      ) : (
        <Box paddingLeft={2} marginTop={1}>
          <Text color="yellow">任务未能生成最终回答。</Text>
        </Box>
      )}
      <Text dimColor>⏱ {elapsedStr}</Text>
      {runLogPath ? <Text dimColor>日志: {runLogPath}</Text> : null}
    </Box>
  );
}
