import { dotProduct, fetchEmbeddings, normalizeVector } from './embedding.js';
import type { ChunkCandidate, EmbeddingConfig, EmbeddingStore, RepositoryIndex } from './types.js';

export async function searchSemantic(
  query: string,
  index: RepositoryIndex,
  embeddingStore: EmbeddingStore,
  config: Required<EmbeddingConfig>,
  limit: number,
): Promise<ChunkCandidate[]> {
  const [queryVector] = await fetchEmbeddings({
    texts: [query],
    config,
  });
  const normalizedQuery = normalizeVector(queryVector);
  const scores: ChunkCandidate[] = [];

  for (const chunk of index.chunks) {
    const entry = embeddingStore.vectors[chunk.id];
    if (!entry || entry.contentHash !== chunk.contentHash) {
      continue;
    }
    const score = dotProduct(normalizedQuery, entry.vector);
    if (score > 0) {
      scores.push({ chunk, score });
    }
  }

  scores.sort((left, right) => right.score - left.score);
  return scores.slice(0, limit);
}
