import { Box, Text } from 'ink';
import type { Store } from '../store.js';
import { useStoreSelector } from '../hooks.js';

interface RagInfoProps {
  store: Store;
}

export function RagInfo({ store }: RagInfoProps) {
  const matches = useStoreSelector(store, (s) => s.ragMatches);
  const mode = useStoreSelector(store, (s) => s.ragSearchMode);
  const reranked = useStoreSelector(store, (s) => s.ragReranked);
  const warnings = useStoreSelector(store, (s) => s.ragWarnings);

  if (!mode && matches.length === 0) return null;

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text color="cyan">
        📚 RAG ({mode ?? 'no_results'}{reranked ? ' + rerank' : ''})
      </Text>
      {warnings.map((w, i) => (
        <Text key={i} color="yellow">  ⚠ {w}</Text>
      ))}
      {matches.length === 0 ? (
        <Text dimColor>  未命中知识库条目</Text>
      ) : (
        matches.slice(0, 5).map((m, i) => (
          <Text key={i} dimColor>
            {'  '}• {m.title}{m.path ? ` (${m.path})` : ''}
          </Text>
        ))
      )}
    </Box>
  );
}
