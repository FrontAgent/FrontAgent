import { basename, extname } from 'node:path';

import { HybridRepositoryKnowledgeBase } from './knowledge-base.js';
import type {
  KnowledgeBaseConfig,
  KnowledgeBaseSource,
  KnowledgeProvider,
  OpenVikingConfig,
  RagQueryMatch,
  RagQueryParams,
  RagQueryResult,
  RagQueryTiming,
  RequiredOpenVikingConfig,
} from './types.js';
import { DEFAULT_FETCH_TIMEOUT_MS, DEFAULT_MAX_RESULTS } from './types.js';
import {
  getNumber,
  getString,
  getTopLevelDir,
  normalizeOptionalBaseUrl,
  parseOptionalBoolean,
  parseOptionalInt,
} from './utils.js';

export function createKnowledgeBase(config: KnowledgeBaseConfig): KnowledgeProvider {
  const normalizedSource = normalizeKnowledgeBaseSource(config);
  const gitProvider = new HybridRepositoryKnowledgeBase(config);

  if (normalizedSource === 'git') {
    return gitProvider;
  }

  const openVikingProvider = new OpenVikingKnowledgeProvider(config);
  if (normalizedSource === 'openviking') {
    return openVikingProvider;
  }

  return new CompositeKnowledgeProvider(openVikingProvider, gitProvider, config);
}

export async function ragQuery(
  params: RagQueryParams,
  config: KnowledgeBaseConfig,
): Promise<RagQueryResult> {
  const knowledgeBase = createKnowledgeBase(config);
  return knowledgeBase.query(params);
}

export function normalizeKnowledgeBaseSource(config: KnowledgeBaseConfig): KnowledgeBaseSource {
  const source =
    config.source ?? (process.env.FRONTAGENT_RAG_SOURCE as KnowledgeBaseSource | undefined);
  if (source === 'git' || source === 'openviking' || source === 'composite') {
    return source;
  }
  return config.openViking?.enabled || process.env.FRONTAGENT_OPENVIKING_ENDPOINT
    ? 'composite'
    : 'git';
}

export function normalizeOpenVikingConfig(config?: OpenVikingConfig): RequiredOpenVikingConfig {
  return {
    enabled:
      config?.enabled ?? parseOptionalBoolean(process.env.FRONTAGENT_OPENVIKING_ENABLED) ?? true,
    endpoint:
      normalizeOptionalBaseUrl(config?.endpoint ?? process.env.FRONTAGENT_OPENVIKING_ENDPOINT) ??
      '',
    apiKey: config?.apiKey ?? process.env.FRONTAGENT_OPENVIKING_API_KEY ?? '',
    corpus: config?.corpus ?? process.env.FRONTAGENT_OPENVIKING_CORPUS ?? '',
    namespace: config?.namespace ?? process.env.FRONTAGENT_OPENVIKING_NAMESPACE ?? '',
    l1Entry:
      config?.l1Entry ??
      process.env.FRONTAGENT_OPENVIKING_L1_ENTRY ??
      'docs/openviking/frontagent-l1.md',
    timeoutMs:
      config?.timeoutMs ??
      parseOptionalInt(process.env.FRONTAGENT_OPENVIKING_TIMEOUT_MS) ??
      DEFAULT_FETCH_TIMEOUT_MS,
  };
}

export function normalizeOpenVikingMatches(
  payload: unknown,
  config: RequiredOpenVikingConfig,
  maxResults?: number,
): RagQueryMatch[] {
  const record =
    typeof payload === 'object' && payload !== null
      ? (payload as Record<string, unknown>)
      : ({} as Record<string, unknown>);
  const rawItems = Array.isArray(record.results)
    ? record.results
    : Array.isArray(record.matches)
      ? record.matches
      : Array.isArray(record.data)
        ? record.data
        : [];

  return rawItems.slice(0, maxResults ?? rawItems.length).map((item: any, index: number) => {
    const path =
      getString(item.path) ?? getString(item.uri) ?? getString(item.id) ?? `openviking:${index}`;
    const title = getString(item.title) ?? basename(path) ?? path;
    const metadata =
      typeof item.metadata === 'object' && item.metadata !== null ? item.metadata : {};
    const extension = getString(metadata.extension) ?? (extname(path).toLowerCase() || '.md');
    const topLevelDir = getString(metadata.topLevelDir) ?? getTopLevelDir(path);
    return {
      id: getString(item.id) ?? `openviking:${path}:${index}`,
      type: getRagMatchType(item.type),
      title,
      sourceUrl: getString(item.sourceUrl) ?? getString(item.url) ?? path,
      path,
      score: getNumber(item.score) ?? getNumber(item.rerankScore) ?? 0,
      keywordScore: getNumber(item.keywordScore),
      semanticScore: getNumber(item.semanticScore),
      rerankScore: getNumber(item.rerankScore),
      snippet: getString(item.snippet) ?? getString(item.content) ?? getString(item.text) ?? '',
      metadata: {
        ...metadata,
        topLevelDir,
        extension,
        chunkIndex: getNumber(metadata.chunkIndex) ?? index,
        lineStart: getNumber(metadata.lineStart) ?? getNumber(item.lineStart) ?? 1,
        lineEnd: getNumber(metadata.lineEnd) ?? getNumber(item.lineEnd) ?? 1,
        provider: 'openviking',
        corpus: config.corpus || undefined,
        namespace: config.namespace || undefined,
        l1Entry: config.l1Entry || undefined,
      },
    };
  });
}

function getRagMatchType(value: unknown): RagQueryMatch['type'] {
  return value === 'wiki' || value === 'doc' || value === 'file' ? value : 'wiki';
}

function normalizeWarnings(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const warnings = value.map((item) => String(item)).filter(Boolean);
  return warnings.length > 0 ? warnings : undefined;
}

function createOpenVikingTiming(startedAt: number): RagQueryTiming {
  return {
    ensureIndexMs: 0,
    bm25Ms: 0,
    semanticMs: 0,
    fusionMs: 0,
    rerankMs: 0,
    totalMs: performance.now() - startedAt,
    cacheHit: false,
  };
}

export const ragQuerySchema = {
  name: 'rag_query',
  description:
    'Query the full repository knowledge base using BM25 + semantic hybrid search with metadata filters.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: 'Natural-language query for the knowledge base',
      },
      maxResults: {
        type: 'number',
        description: 'Maximum number of matches to return',
        default: DEFAULT_MAX_RESULTS,
      },
      refresh: {
        type: 'boolean',
        description: 'Force a repository sync and re-index before querying',
        default: false,
      },
      filters: {
        type: 'object',
        description:
          'Optional metadata filters applied after keyword and semantic candidate retrieval',
        properties: {
          topLevelDirs: {
            type: 'array',
            items: { type: 'string' },
          },
          extensions: {
            type: 'array',
            items: { type: 'string' },
          },
          pathPrefixes: {
            type: 'array',
            items: { type: 'string' },
          },
          excludePathPrefixes: {
            type: 'array',
            items: { type: 'string' },
          },
        },
      },
    },
    required: ['query'],
  },
};

class OpenVikingKnowledgeProvider implements KnowledgeProvider {
  private readonly config: RequiredOpenVikingConfig;

  constructor(config: KnowledgeBaseConfig) {
    this.config = normalizeOpenVikingConfig(config.openViking);
  }

  async query(params: RagQueryParams): Promise<RagQueryResult> {
    if (!this.config.enabled) {
      return { success: false, error: 'OpenViking knowledge provider is disabled.' };
    }
    if (!this.config.endpoint) {
      return { success: false, error: 'OpenViking endpoint is not configured.' };
    }
    if (!params.query?.trim()) {
      return { success: false, error: 'query is required' };
    }

    const startedAt = performance.now();
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(this.config.endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(this.config.apiKey ? { authorization: `Bearer ${this.config.apiKey}` } : {}),
        },
        body: JSON.stringify({
          query: params.query.trim(),
          maxResults: params.maxResults,
          refresh: params.refresh,
          filters: params.filters,
          corpus: this.config.corpus || undefined,
          namespace: this.config.namespace || undefined,
          l1Entry: this.config.l1Entry || undefined,
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        return {
          success: false,
          error: `OpenViking query failed: ${response.status} ${response.statusText}`,
          timing: createOpenVikingTiming(startedAt),
        };
      }

      const payload = (await response.json()) as unknown;
      const payloadRecord =
        typeof payload === 'object' && payload !== null
          ? (payload as Record<string, unknown>)
          : ({} as Record<string, unknown>);
      const matches = normalizeOpenVikingMatches(payload, this.config, params.maxResults);
      return {
        success: true,
        syncedAt: getString(payloadRecord.syncedAt) ?? new Date().toISOString(),
        sourceRevision:
          getString(payloadRecord.sourceRevision) ?? getString(payloadRecord.revision),
        searchMode: 'openviking',
        reranked: Boolean(payloadRecord.reranked),
        warnings: normalizeWarnings(payloadRecord.warnings),
        results: matches,
        timing: createOpenVikingTiming(startedAt),
      };
    } catch (error) {
      return {
        success: false,
        error: `OpenViking query unavailable: ${error instanceof Error ? error.message : String(error)}`,
        timing: createOpenVikingTiming(startedAt),
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}

class CompositeKnowledgeProvider implements KnowledgeProvider {
  constructor(
    private readonly openViking: KnowledgeProvider,
    private readonly git: KnowledgeProvider,
    private readonly config: KnowledgeBaseConfig,
  ) {}

  async query(params: RagQueryParams): Promise<RagQueryResult> {
    const openVikingResult = await this.openViking.query(params);
    if (openVikingResult.success && (openVikingResult.results?.length ?? 0) > 0) {
      return {
        ...openVikingResult,
        searchMode: 'composite',
        warnings: [
          ...(openVikingResult.warnings ?? []),
          'OpenViking provider returned results; Git RAG fallback was not used.',
        ],
      };
    }

    if (this.config.openViking?.fallbackToGit === false) {
      return openVikingResult;
    }

    const gitResult = await this.git.query(params);
    return {
      ...gitResult,
      searchMode: gitResult.searchMode ?? 'composite',
      warnings: [
        ...(openVikingResult.error
          ? [`OpenViking fallback reason: ${openVikingResult.error}`]
          : []),
        ...(openVikingResult.warnings ?? []),
        ...(gitResult.warnings ?? []),
      ],
    };
  }
}
