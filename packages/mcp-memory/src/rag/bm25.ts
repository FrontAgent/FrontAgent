import type {
  ChunkCandidate,
  DocumentCandidate,
  RagMetadataFilter,
  RepositoryChunk,
  RepositoryIndex,
} from './types.js';

export function searchBm25(index: RepositoryIndex, query: string, limit: number): ChunkCandidate[] {
  const queryTerms = countTerms(tokenize(query));
  if (Object.keys(queryTerms).length === 0) {
    return [];
  }

  const scores: ChunkCandidate[] = [];
  for (const chunk of index.chunks) {
    const score = computeBm25Score(chunk, queryTerms, index.bm25);
    if (score > 0) {
      scores.push({ chunk, score });
    }
  }

  scores.sort((left, right) => right.score - left.score);
  return scores.slice(0, limit);
}

function computeBm25Score(
  chunk: RepositoryChunk,
  queryTerms: Record<string, number>,
  bm25: RepositoryIndex['bm25'],
): number {
  const k1 = 1.5;
  const b = 0.75;
  const averageDocLength = bm25.averageDocumentLength || 1;
  let score = 0;

  for (const [term, queryFrequency] of Object.entries(queryTerms)) {
    const termFrequency = chunk.termFrequency[term] ?? 0;
    if (termFrequency === 0) {
      continue;
    }
    const documentFrequency = bm25.documentFrequency[term] ?? 0;
    const idf = Math.log(
      1 + (bm25.documentCount - documentFrequency + 0.5) / (documentFrequency + 0.5),
    );
    const numerator = termFrequency * (k1 + 1);
    const denominator = termFrequency + k1 * (1 - b + b * (chunk.tokenCount / averageDocLength));
    score += idf * (numerator / denominator) * queryFrequency;
  }

  return score;
}

export function aggregateChunkCandidates(
  chunkCandidates: ChunkCandidate[],
  index: RepositoryIndex,
  filters?: RagMetadataFilter,
): DocumentCandidate[] {
  const documentsById = new Map(index.documents.map((document) => [document.id, document]));
  const bestByDocument = new Map<string, DocumentCandidate>();

  for (let rank = 0; rank < chunkCandidates.length; rank++) {
    const candidate = chunkCandidates[rank];
    if (!matchesMetadataFilter(candidate.chunk, filters)) {
      continue;
    }
    const document = documentsById.get(candidate.chunk.documentId);
    if (!document) {
      continue;
    }
    const existing = bestByDocument.get(document.id);
    if (!existing || candidate.score > existing.score) {
      bestByDocument.set(document.id, {
        document,
        chunk: candidate.chunk,
        score: candidate.score,
        rank: rank + 1,
      });
    }
  }

  return Array.from(bestByDocument.values()).sort((left, right) => right.score - left.score);
}

export function matchesMetadataFilter(
  chunk: RepositoryChunk,
  filters?: RagMetadataFilter,
): boolean {
  if (!filters) {
    return true;
  }

  if (
    filters.topLevelDirs &&
    filters.topLevelDirs.length > 0 &&
    !filters.topLevelDirs.includes(chunk.metadata.topLevelDir)
  ) {
    return false;
  }

  if (
    filters.extensions &&
    filters.extensions.length > 0 &&
    !filters.extensions.includes(chunk.metadata.extension)
  ) {
    return false;
  }

  if (
    filters.pathPrefixes &&
    filters.pathPrefixes.length > 0 &&
    !filters.pathPrefixes.some((prefix) => chunk.path.startsWith(prefix))
  ) {
    return false;
  }

  if (filters.excludePathPrefixes?.some((prefix) => chunk.path.startsWith(prefix))) {
    return false;
  }

  return true;
}

export function tokenize(input: string): string[] {
  const tokens: string[] = [];
  const seen = new Set<string>();

  const emit = (token: string) => {
    if (token.length >= 2 && !seen.has(token)) {
      seen.add(token);
      tokens.push(token);
    }
  };

  const normalized = input.toLowerCase();
  for (const match of normalized.match(/[a-z0-9_@./:-]+/g) ?? []) {
    emit(match);
    if (match.includes('_')) {
      for (const part of match.split('_')) {
        emit(part);
      }
    }
  }

  for (const identifier of input.match(/[A-Za-z][a-zA-Z0-9]*/g) ?? []) {
    if (!/[a-z]/.test(identifier) || !/[A-Z]/.test(identifier)) {
      continue;
    }
    const parts = identifier
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
      .split(/\s+/);
    for (const part of parts) {
      emit(part.toLowerCase());
    }
  }

  for (const match of normalized.match(/[一-鿿]+/g) ?? []) {
    if (match.length === 1) {
      emit(match);
      continue;
    }
    for (let i = 0; i < match.length - 1; i++) {
      emit(match.slice(i, i + 2));
    }
  }

  return tokens;
}

function countTerms(tokens: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const token of tokens) {
    counts[token] = (counts[token] ?? 0) + 1;
  }
  return counts;
}

export function buildSnippet(text: string, query: string): string {
  const normalizedText = text.toLowerCase();
  const queryTokens = tokenize(query);
  for (const token of [query.toLowerCase(), ...queryTokens]) {
    if (!token) {
      continue;
    }
    const index = normalizedText.indexOf(token);
    if (index >= 0) {
      const start = Math.max(0, index - 120);
      const end = Math.min(text.length, index + 220);
      return text.slice(start, end).trim();
    }
  }
  return text.slice(0, 320).trim();
}
