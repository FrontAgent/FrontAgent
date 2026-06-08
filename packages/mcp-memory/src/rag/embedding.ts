import type { EmbeddingConfig, RepositoryChunk } from './types.js';
import {
  DEFAULT_EMBEDDING_MAX_INPUT_CHARS,
  DEFAULT_EMBEDDING_MAX_RETRIES,
  DEFAULT_EMBEDDING_RETRY_BASE_DELAY_MS,
} from './types.js';
import { normalizeEmbeddingBaseUrl, sleep } from './utils.js';

export class EmbeddingRequestError extends Error {
  readonly status: number;
  readonly retryAfterMs?: number;

  constructor(message: string, status: number, retryAfterMs?: number) {
    super(message);
    this.name = 'EmbeddingRequestError';
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

export async function fetchEmbeddings(input: {
  texts: string[];
  config: Required<EmbeddingConfig>;
}): Promise<number[][]> {
  if (input.texts.length === 0) {
    return [];
  }

  let attempt = 0;

  while (true) {
    try {
      return await requestEmbeddings(input);
    } catch (error) {
      if (shouldSplitEmbeddingBatch(error) && input.texts.length > 1) {
        const midpoint = Math.ceil(input.texts.length / 2);
        const left = await fetchEmbeddings({
          texts: input.texts.slice(0, midpoint),
          config: input.config,
        });
        const right = await fetchEmbeddings({
          texts: input.texts.slice(midpoint),
          config: input.config,
        });
        return [...left, ...right];
      }

      if (shouldRetryEmbeddingRequest(error) && attempt < DEFAULT_EMBEDDING_MAX_RETRIES) {
        const delayMs = getEmbeddingRetryDelayMs(error, attempt);
        await sleep(delayMs);
        attempt += 1;
        continue;
      }

      throw error;
    }
  }
}

async function requestEmbeddings(input: {
  texts: string[];
  config: Required<EmbeddingConfig>;
}): Promise<number[][]> {
  if (!input.config.apiKey) {
    throw new Error('missing embedding api key');
  }

  const endpoint = normalizeEmbeddingBaseUrl(input.config.baseURL);
  const body: Record<string, unknown> = {
    model: input.config.model,
    input: input.texts,
    encoding_format: 'float',
  };
  if (input.config.dimensions) {
    body.dimensions = input.config.dimensions;
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${input.config.apiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(input.config.requestTimeoutMs),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new EmbeddingRequestError(
      `embedding request failed: ${response.status} ${response.statusText} ${errorText}`.trim(),
      response.status,
      parseRetryAfterHeader(response.headers.get('retry-after')),
    );
  }

  const payload = (await response.json()) as {
    data?: Array<{ embedding?: number[] }>;
  };
  const vectors = payload.data?.map((item) => item.embedding ?? []);
  if (!vectors || vectors.length !== input.texts.length) {
    throw new Error('embedding response did not contain the expected number of vectors');
  }

  return vectors;
}

function shouldSplitEmbeddingBatch(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    message.includes('maximum context length') ||
    message.includes('please reduce your prompt') ||
    message.includes('too many tokens') ||
    message.includes('context length') ||
    message.includes('maximum input length')
  );
}

function shouldRetryEmbeddingRequest(error: unknown): boolean {
  if (error instanceof EmbeddingRequestError) {
    return error.status === 429 || error.status >= 500;
  }

  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    message.includes('429') ||
    message.includes('too many requests') ||
    message.includes('rate limit') ||
    message.includes('etimedout') ||
    message.includes('timeout') ||
    message.includes('econnreset') ||
    message.includes('socket hang up')
  );
}

function getEmbeddingRetryDelayMs(error: unknown, attempt: number): number {
  if (error instanceof EmbeddingRequestError && error.retryAfterMs) {
    return error.retryAfterMs;
  }

  const multiplier = 2 ** attempt;
  return DEFAULT_EMBEDDING_RETRY_BASE_DELAY_MS * multiplier;
}

function parseRetryAfterHeader(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }

  const seconds = Number(value);
  if (!Number.isNaN(seconds) && seconds >= 0) {
    return seconds * 1000;
  }

  const date = Date.parse(value);
  if (Number.isNaN(date)) {
    return undefined;
  }

  return Math.max(0, date - Date.now());
}

export function normalizeVector(vector: number[]): number[] {
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (!Number.isFinite(norm) || norm === 0) {
    return vector;
  }
  return vector.map((value) => value / norm);
}

export function dotProduct(left: number[], right: number[]): number {
  const length = Math.min(left.length, right.length);
  let sum = 0;
  for (let i = 0; i < length; i++) {
    sum += left[i] * right[i];
  }
  return sum;
}

export function createEmbeddingBatches<T extends { estimatedTokens: number }>(
  items: T[],
  maxItems: number,
  maxEstimatedTokens: number,
): T[][] {
  if (items.length === 0) {
    return [];
  }

  const batches: T[][] = [];
  let currentBatch: T[] = [];
  let currentTokens = 0;

  for (const item of items) {
    const wouldOverflowByCount = currentBatch.length >= maxItems;
    const wouldOverflowByTokens =
      currentBatch.length > 0 && currentTokens + item.estimatedTokens > maxEstimatedTokens;

    if (wouldOverflowByCount || wouldOverflowByTokens) {
      batches.push(currentBatch);
      currentBatch = [];
      currentTokens = 0;
    }

    currentBatch.push(item);
    currentTokens += item.estimatedTokens;
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  return batches;
}

export function estimateEmbeddingTokens(input: string): number {
  return Math.max(1, Math.ceil(input.length / 3));
}

export function buildEmbeddingInput(chunk: RepositoryChunk): string {
  return [
    `path: ${chunk.path}`,
    `top-level: ${chunk.metadata.topLevelDir}`,
    truncateEmbeddingText(chunk.text, DEFAULT_EMBEDDING_MAX_INPUT_CHARS),
  ].join('\n');
}

function truncateEmbeddingText(text: string, maxChars: number): string {
  if (text.length <= maxChars) {
    return text;
  }

  const marker = '\n...[truncated for embedding]...\n';
  if (maxChars <= marker.length + 32) {
    return text.slice(0, maxChars);
  }

  const remaining = maxChars - marker.length;
  const headChars = Math.ceil(remaining * 0.75);
  const tailChars = remaining - headChars;
  return `${text.slice(0, headChars)}${marker}${text.slice(-tailChars)}`;
}

export function isCompatibleEmbeddingStore(
  store: { model: string; baseURL: string; dimensions?: number } | null,
  config: Required<EmbeddingConfig>,
): boolean {
  return Boolean(
    store &&
      store.model === config.model &&
      store.baseURL === config.baseURL &&
      store.dimensions === config.dimensions,
  );
}
