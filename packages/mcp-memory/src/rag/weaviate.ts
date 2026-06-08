import { fetchEmbeddings, normalizeVector } from './embedding.js';
import type {
  ChunkCandidate,
  EmbeddingConfig,
  RepositoryChunk,
  RepositoryIndex,
  RequiredHybridConfig,
  WeaviateVectorStoreConfig,
} from './types.js';
import { DEFAULT_WEAVIATE_COLLECTION_PREFIX } from './types.js';
import { hashText, normalizeBaseUrl } from './utils.js';

export async function searchSemanticWithWeaviate(
  query: string,
  index: RepositoryIndex,
  embeddingConfig: Required<EmbeddingConfig>,
  weaviateConfig: Required<WeaviateVectorStoreConfig>,
  collectionName: string,
  limit: number,
): Promise<ChunkCandidate[]> {
  const [queryVector] = await fetchEmbeddings({
    texts: [query],
    config: embeddingConfig,
  });
  const normalizedQuery = normalizeVector(queryVector);
  const vectorLiteral = JSON.stringify(Array.from(normalizedQuery));
  const graphqlQuery = `{
    Get {
      ${collectionName}(nearVector: { vector: ${vectorLiteral} }, limit: ${Math.max(limit, 1)}) {
        chunkId
        contentHash
        _additional {
          id
          distance
          certainty
        }
      }
    }
  }`;
  const payload = await requestWeaviateGraphQL<{
    Get?: Record<
      string,
      Array<{
        chunkId?: string;
        contentHash?: string;
        _additional?: {
          id?: string;
          distance?: number;
          certainty?: number;
        };
      }>
    >;
  }>(weaviateConfig, graphqlQuery);

  const results = payload.Get?.[collectionName] ?? [];
  const chunksById = new Map(index.chunks.map((chunk) => [chunk.id, chunk]));
  const candidates: ChunkCandidate[] = [];
  const seenChunkIds = new Set<string>();

  for (const item of results) {
    if (!item.chunkId || seenChunkIds.has(item.chunkId)) {
      continue;
    }
    const chunk = chunksById.get(item.chunkId);
    if (!chunk) {
      continue;
    }
    if (item.contentHash && item.contentHash !== chunk.contentHash) {
      continue;
    }

    const certainty = item._additional?.certainty;
    const distance = item._additional?.distance;
    const score =
      typeof certainty === 'number'
        ? certainty
        : typeof distance === 'number'
          ? Math.max(0, 1 - distance)
          : 0;

    seenChunkIds.add(item.chunkId);
    candidates.push({ chunk, score });
  }

  candidates.sort((left, right) => right.score - left.score);
  return candidates.slice(0, limit);
}

export async function ensureWeaviateCollection(
  config: Required<WeaviateVectorStoreConfig>,
  collectionName: string,
): Promise<'exists' | 'created'> {
  const baseURL = normalizeBaseUrl(config.baseURL);
  const getResponse = await fetch(`${baseURL}/v1/schema/${collectionName}`, {
    method: 'GET',
    headers: buildWeaviateHeaders(config),
    signal: AbortSignal.timeout(config.requestTimeoutMs),
  });

  if (getResponse.ok) {
    return 'exists';
  }

  if (getResponse.status !== 404) {
    const errorText = await getResponse.text();
    throw new Error(
      `weaviate schema check failed: ${getResponse.status} ${getResponse.statusText} ${errorText}`.trim(),
    );
  }

  const response = await fetch(`${baseURL}/v1/schema`, {
    method: 'POST',
    headers: buildWeaviateHeaders(config),
    body: JSON.stringify({
      class: collectionName,
      vectorizer: 'none',
      vectorIndexConfig: {
        distance: 'cosine',
      },
      properties: [
        { name: 'chunkId', dataType: ['text'] },
        { name: 'documentId', dataType: ['text'] },
        { name: 'path', dataType: ['text'] },
        { name: 'title', dataType: ['text'] },
        { name: 'sourceUrl', dataType: ['text'] },
        { name: 'contentHash', dataType: ['text'] },
        { name: 'topLevelDir', dataType: ['text'] },
        { name: 'extension', dataType: ['text'] },
        { name: 'chunkIndex', dataType: ['int'] },
        { name: 'totalChunks', dataType: ['int'] },
        { name: 'lineStart', dataType: ['int'] },
        { name: 'lineEnd', dataType: ['int'] },
        { name: 'text', dataType: ['text'] },
      ],
    }),
    signal: AbortSignal.timeout(config.requestTimeoutMs),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `weaviate schema create failed: ${response.status} ${response.statusText} ${errorText}`.trim(),
    );
  }

  return 'created';
}

export async function deleteWeaviateCollection(
  config: Required<WeaviateVectorStoreConfig>,
  collectionName: string,
): Promise<void> {
  const baseURL = normalizeBaseUrl(config.baseURL);
  const response = await fetch(`${baseURL}/v1/schema/${collectionName}`, {
    method: 'DELETE',
    headers: buildWeaviateHeaders(config),
    signal: AbortSignal.timeout(config.requestTimeoutMs),
  });

  if (response.ok || response.status === 404) {
    return;
  }

  const errorText = await response.text();
  throw new Error(
    `weaviate schema delete failed: ${response.status} ${response.statusText} ${errorText}`.trim(),
  );
}

export async function upsertWeaviateObjects(input: {
  config: Required<WeaviateVectorStoreConfig>;
  collectionName: string;
  objects: Array<{ chunk: RepositoryChunk; vector: number[] }>;
}): Promise<void> {
  if (input.objects.length === 0) {
    return;
  }

  const baseURL = normalizeBaseUrl(input.config.baseURL);
  const response = await fetch(`${baseURL}/v1/batch/objects`, {
    method: 'POST',
    headers: buildWeaviateHeaders(input.config),
    body: JSON.stringify({
      objects: input.objects.map((item) => ({
        class: input.collectionName,
        id: buildWeaviateObjectId(item.chunk.id),
        properties: {
          chunkId: item.chunk.id,
          documentId: item.chunk.documentId,
          path: item.chunk.path,
          title: item.chunk.title,
          sourceUrl: item.chunk.sourceUrl,
          contentHash: item.chunk.contentHash,
          topLevelDir: item.chunk.metadata.topLevelDir,
          extension: item.chunk.metadata.extension,
          chunkIndex: item.chunk.metadata.chunkIndex,
          totalChunks: item.chunk.metadata.totalChunks,
          lineStart: item.chunk.metadata.lineStart,
          lineEnd: item.chunk.metadata.lineEnd,
          text: item.chunk.text,
        },
        vector: item.vector,
      })),
    }),
    signal: AbortSignal.timeout(input.config.requestTimeoutMs),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `weaviate batch import failed: ${response.status} ${response.statusText} ${errorText}`.trim(),
    );
  }

  const payload = (await response.json()) as
    | Array<{
        result?: {
          errors?: {
            error?: Array<{ message?: string }>;
          };
        };
      }>
    | { errors?: Array<{ message?: string }> };

  const topLevelErrors =
    !Array.isArray(payload) && payload.errors?.map((item) => item.message).filter(Boolean);
  if (topLevelErrors && topLevelErrors.length > 0) {
    throw new Error(`weaviate batch import failed: ${topLevelErrors.join('; ')}`);
  }

  if (Array.isArray(payload)) {
    const itemErrors = payload
      .flatMap((item) => item.result?.errors?.error ?? [])
      .map((item) => item.message)
      .filter((message): message is string => Boolean(message));
    if (itemErrors.length > 0) {
      throw new Error(`weaviate batch import failed: ${itemErrors.join('; ')}`);
    }
  }
}

export async function requestWeaviateGraphQL<T>(
  config: Required<WeaviateVectorStoreConfig>,
  query: string,
): Promise<T> {
  const baseURL = normalizeBaseUrl(config.baseURL);
  const response = await fetch(`${baseURL}/v1/graphql`, {
    method: 'POST',
    headers: buildWeaviateHeaders(config),
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(config.requestTimeoutMs),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `weaviate graphql request failed: ${response.status} ${response.statusText} ${errorText}`.trim(),
    );
  }

  const payload = (await response.json()) as {
    data?: T;
    errors?: Array<{ message?: string }>;
  };
  if (payload.errors && payload.errors.length > 0) {
    throw new Error(
      `weaviate graphql request failed: ${payload.errors
        .map((item) => item.message)
        .filter(Boolean)
        .join('; ')}`,
    );
  }
  if (!payload.data) {
    throw new Error('weaviate graphql response did not contain data');
  }

  return payload.data;
}

function buildWeaviateHeaders(config: Required<WeaviateVectorStoreConfig>): Record<string, string> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };
  if (config.apiKey) {
    headers.authorization = `Bearer ${config.apiKey}`;
  }
  return headers;
}

export function getWeaviateCollectionName(config: RequiredHybridConfig): string {
  const prefix = sanitizeWeaviateCollectionPrefix(config.vectorStore.weaviate.collectionPrefix);
  const identity = hashText(
    `${config.repoUrl}:${config.branch}:${config.embedding.model}:${config.embedding.dimensions ?? 'default'}`,
  ).slice(0, 12);
  return `${prefix}${identity}`;
}

function sanitizeWeaviateCollectionPrefix(prefix: string): string {
  const normalized = prefix.replace(/[^a-z0-9]/gi, '');
  const fallback = DEFAULT_WEAVIATE_COLLECTION_PREFIX;
  const candidate = normalized.length > 0 ? normalized : fallback;
  const capitalized = `${candidate.charAt(0).toUpperCase()}${candidate.slice(1)}`;
  return /^[A-Z]/.test(capitalized) ? capitalized : fallback;
}

function buildWeaviateObjectId(chunkId: string): string {
  const hash = hashText(chunkId);
  const segment4 = ((Number.parseInt(hash.slice(16, 18), 16) & 0x3f) | 0x80)
    .toString(16)
    .padStart(2, '0');
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    `4${hash.slice(13, 16)}`,
    `${segment4}${hash.slice(18, 20)}`,
    hash.slice(20, 32),
  ].join('-');
}
