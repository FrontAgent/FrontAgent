import type { DocumentCandidate, RerankerConfig } from './types.js';
import { normalizeRerankerBaseUrl } from './utils.js';

export function fuseDocumentCandidates(input: {
  keywordCandidates: DocumentCandidate[];
  semanticCandidates: DocumentCandidate[];
  maxResults: number;
  keywordWeight: number;
  semanticWeight: number;
}): DocumentCandidate[] {
  const keywordMax = input.keywordCandidates[0]?.score ?? 0;
  const semanticMax = input.semanticCandidates[0]?.score ?? 0;
  const fused = new Map<string, DocumentCandidate>();

  const effectiveKeywordWeight = input.semanticCandidates.length > 0 ? input.keywordWeight : 1;
  const effectiveSemanticWeight = input.semanticCandidates.length > 0 ? input.semanticWeight : 0;

  for (const candidate of input.keywordCandidates) {
    fused.set(candidate.document.id, {
      ...candidate,
      score: 0,
      keywordScore: candidate.score,
      semanticScore: undefined,
    });
  }

  for (const candidate of input.semanticCandidates) {
    const existing = fused.get(candidate.document.id);
    if (existing) {
      if (candidate.score > (existing.semanticScore ?? 0)) {
        existing.semanticScore = candidate.score;
        if (candidate.score > (existing.keywordScore ?? 0)) {
          existing.chunk = candidate.chunk;
        }
      }
    } else {
      fused.set(candidate.document.id, {
        ...candidate,
        score: 0,
        keywordScore: undefined,
        semanticScore: candidate.score,
      });
    }
  }

  const ranked = Array.from(fused.values()).map((candidate) => {
    const keywordScore = candidate.keywordScore ?? 0;
    const semanticScore = candidate.semanticScore ?? 0;
    const keywordNormalized = keywordMax > 0 ? keywordScore / keywordMax : 0;
    const semanticNormalized = semanticMax > 0 ? semanticScore / semanticMax : 0;
    const keywordRank = reciprocalRank(findRank(input.keywordCandidates, candidate.document.id));
    const semanticRank = reciprocalRank(findRank(input.semanticCandidates, candidate.document.id));

    candidate.score =
      effectiveKeywordWeight * keywordNormalized +
      effectiveSemanticWeight * semanticNormalized +
      0.1 * keywordRank +
      0.1 * semanticRank;
    return candidate;
  });

  ranked.sort((left, right) => right.score - left.score);
  return ranked.slice(0, input.maxResults);
}

export async function rerankDocumentCandidates(input: {
  query: string;
  candidates: DocumentCandidate[];
  maxResults: number;
  config: Required<RerankerConfig>;
}): Promise<DocumentCandidate[]> {
  const rerankPool = input.candidates.slice(
    0,
    Math.max(input.maxResults, input.config.candidateCount),
  );
  if (rerankPool.length === 0) {
    return [];
  }

  if (input.config.provider !== 'jina-compatible') {
    throw new Error(`unsupported reranker provider: ${input.config.provider}`);
  }

  const documents = rerankPool.map((candidate) =>
    buildRerankerDocument(candidate, input.config.maxDocumentChars),
  );
  const rerankedItems = await requestJinaCompatibleRerank({
    config: input.config,
    query: input.query,
    documents,
    topN: Math.min(Math.max(input.maxResults, 1), rerankPool.length),
  });

  const byIndex = new Map(rerankedItems.map((item) => [item.index, item.score]));
  const reranked = rerankPool
    .flatMap((candidate, index) => {
      const score = byIndex.get(index);
      if (score === undefined) {
        return [];
      }
      return [
        {
          ...candidate,
          rerankScore: score,
          score,
        },
      ];
    })
    .sort((left, right) => (right.rerankScore ?? 0) - (left.rerankScore ?? 0));

  if (reranked.length >= input.maxResults) {
    return reranked.slice(0, input.maxResults);
  }

  const rerankedDocIds = new Set(reranked.map((candidate) => candidate.document.id));
  const fallback = rerankPool.filter((candidate) => !rerankedDocIds.has(candidate.document.id));
  return [...reranked, ...fallback].slice(0, input.maxResults);
}

function buildRerankerDocument(candidate: DocumentCandidate, maxChars: number): string {
  return truncateRerankerDocument(
    [
      `path: ${candidate.document.path}`,
      `title: ${candidate.document.title}`,
      candidate.chunk.text,
    ].join('\n'),
    maxChars,
  );
}

function truncateRerankerDocument(text: string, maxChars: number): string {
  if (text.length <= maxChars) {
    return text;
  }

  const marker = '\n...[truncated for rerank]...\n';
  if (maxChars <= marker.length + 32) {
    return text.slice(0, maxChars);
  }

  const remaining = maxChars - marker.length;
  const headChars = Math.ceil(remaining * 0.8);
  const tailChars = remaining - headChars;
  return `${text.slice(0, headChars)}${marker}${text.slice(-tailChars)}`;
}

async function requestJinaCompatibleRerank(input: {
  config: Required<RerankerConfig>;
  query: string;
  documents: string[];
  topN: number;
}): Promise<Array<{ index: number; score: number }>> {
  const endpoint = normalizeRerankerBaseUrl(input.config.baseURL);
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${input.config.apiKey}`,
    },
    body: JSON.stringify({
      model: input.config.model,
      query: input.query,
      documents: input.documents,
      top_n: input.topN,
      return_documents: false,
    }),
    signal: AbortSignal.timeout(input.config.requestTimeoutMs),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `rerank request failed: ${response.status} ${response.statusText} ${errorText}`.trim(),
    );
  }

  const payload = (await response.json()) as {
    results?: Array<{ index?: number; relevance_score?: number; score?: number }>;
    data?: Array<{ index?: number; relevance_score?: number; score?: number }>;
  };
  const items = payload.results ?? payload.data ?? [];

  return items
    .map((item) => ({
      index: item.index ?? -1,
      score: item.relevance_score ?? item.score ?? 0,
    }))
    .filter((item) => item.index >= 0)
    .sort((left, right) => right.score - left.score);
}

function findRank(candidates: DocumentCandidate[], documentId: string): number | undefined {
  const candidate = candidates.find((item) => item.document.id === documentId);
  return candidate?.rank;
}

function reciprocalRank(rank?: number): number {
  if (!rank) {
    return 0;
  }
  return 1 / (rank + 50);
}
