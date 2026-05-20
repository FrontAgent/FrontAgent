import type { ContextManager } from '../context.js';
import type { Executor } from '../executor.js';
import type { LLMService } from '../llm.js';
import type { AgentConfig, RagQueryTiming } from '../types.js';
import {
  type RagContextMatchInternal,
  type RetrievedRagContext,
  mergeRetrievalQuery,
  normalizeSearchQuery,
  ragQueryRewriteSchema,
} from './helpers.js';

export interface RagRetrievalDeps {
  config: AgentConfig;
  executor: Executor;
  llmService: LLMService;
  contextManager: ContextManager;
  debugLog: (...args: unknown[]) => void;
  debugWarn: (...args: unknown[]) => void;
}

export async function retrieveRagContext(
  deps: RagRetrievalDeps,
  taskId: string,
  query: string,
): Promise<RetrievedRagContext | undefined> {
  if (deps.config.rag?.enabled === false) {
    return undefined;
  }

  const startedAt = Date.now();
  try {
    const rewriteStartedAt = Date.now();
    const rewrittenQuery = await rewriteRagQueryForRetrieval(deps, query);
    const rewriteDurationMs = Date.now() - rewriteStartedAt;
    const retrievalQuery = rewrittenQuery
      ? mergeRetrievalQuery(query, rewrittenQuery)
      : normalizeSearchQuery(query);

    if (rewrittenQuery) {
      deps.debugLog('[Agent] RAG query rewrite applied:', {
        originalQuery: query,
        rewrittenQuery,
        retrievalQuery,
      });
    }

    const result = (await deps.executor.callTool('rag_query', {
      query: retrievalQuery,
      maxResults: deps.config.rag?.maxResults ?? 5,
    })) as {
      success?: boolean;
      searchMode?: 'hybrid' | 'keyword_only' | 'openviking' | 'composite';
      reranked?: boolean;
      warnings?: string[];
      results?: Array<{
        type: string;
        title: string;
        sourceUrl: string;
        snippet: string;
        path?: string;
        score?: number;
        rerankScore?: number;
      }>;
      timing?: RagQueryTiming;
      error?: string;
    };

    if (!result.success) {
      const warnings = [
        `RAG query failed after ${Date.now() - startedAt}ms: ${result.error ?? 'unknown error'}`,
      ];
      deps.contextManager.setRagMetadata(taskId, {
        matches: [],
        searchMode: result.searchMode,
        warnings,
      });
      deps.debugWarn('[Agent] RAG query failed:', {
        durationMs: Date.now() - startedAt,
        rewriteDurationMs,
        error: result.error,
      });
      return {
        formattedResults: [],
        matches: [],
        searchMode: result.searchMode,
        reranked: result.reranked,
        warnings,
        timing: result.timing,
      };
    }

    const matches: RagContextMatchInternal[] = (result.results ?? []).map((item) => ({
      type: item.type,
      title: item.title,
      sourceUrl: item.sourceUrl,
      snippet: item.snippet,
      path: item.path,
      score: item.score,
      rerankScore: item.rerankScore,
    }));
    const formattedResults = matches.map((item) => formatRagResult(item));
    if (formattedResults.length > 0) {
      deps.contextManager.addRagResults(taskId, formattedResults);
    }
    deps.contextManager.setRagMetadata(taskId, {
      matches,
      searchMode: result.searchMode,
      warnings: result.warnings,
    });
    deps.debugLog('[Agent] RAG retrieval completed:', {
      durationMs: Date.now() - startedAt,
      rewriteDurationMs,
      timing: result.timing,
      searchMode: result.searchMode,
      resultCount: matches.length,
      reranked: result.reranked,
      warningCount: result.warnings?.length ?? 0,
    });
    return {
      formattedResults,
      matches,
      searchMode: result.searchMode,
      reranked: result.reranked,
      warnings: result.warnings,
      timing: result.timing,
    };
  } catch (error) {
    deps.debugWarn('[Agent] Failed to retrieve RAG context:', error);
    const warnings = [
      `RAG query failed after ${Date.now() - startedAt}ms: ${error instanceof Error ? error.message : String(error)}`,
    ];
    deps.contextManager.setRagMetadata(taskId, {
      matches: [],
      warnings,
    });
    return {
      formattedResults: [],
      matches: [],
      warnings,
    };
  }
}

export async function rewriteRagQueryForRetrieval(
  deps: RagRetrievalDeps,
  query: string,
): Promise<string | undefined> {
  const rewriteConfig = deps.config.rag?.queryRewrite;
  if (rewriteConfig?.enabled === false || rewriteConfig?.mode === 'never') {
    return undefined;
  }

  const normalizedQuery = normalizeSearchQuery(query);
  if (!normalizedQuery) {
    return undefined;
  }

  if ((rewriteConfig?.mode ?? 'auto') === 'auto' && !shouldRewriteRagQuery(normalizedQuery)) {
    return undefined;
  }

  try {
    const rewritten = await deps.llmService.generateObject({
      system: `你是前端领域知识库的检索查询优化器。
你的任务不是回答问题，而是把用户原始需求改写成更适合知识库检索的专业查询。
要求：
1. 保留用户原始意图和核心词，不要改变需求。
2. 如果用户说法口语化、不专业或过于模糊，补充前端领域常用术语、英文关键词、同义词和相关实现概念。
3. 如果问题涉及具体框架或技术方向，补充可能的专业表达，例如 React、Vue、DOM、CSS、表单控件、listbox、combobox、dropdown 等。
4. 只输出一个用于检索的查询字符串，不要输出解释、前缀、编号或 Markdown。`,
      messages: [
        {
          role: 'user',
          content: `请把下面的用户需求改写为适合前端知识库检索的查询：\n${normalizedQuery}`,
        },
      ],
      schema: ragQueryRewriteSchema,
      maxTokens: deps.config.rag?.queryRewrite?.maxTokens ?? 160,
      temperature: deps.config.rag?.queryRewrite?.temperature ?? 0.1,
    });

    const rewrittenQuery = normalizeSearchQuery(rewritten.searchQuery);
    if (!rewrittenQuery || rewrittenQuery === normalizedQuery) {
      return undefined;
    }

    return rewrittenQuery;
  } catch (error) {
    deps.debugWarn('[Agent] Failed to rewrite RAG query, falling back to original query:', error);
    return undefined;
  }
}

function shouldRewriteRagQuery(query: string): boolean {
  const normalized = normalizeSearchQuery(query);
  if (!normalized) return false;
  if (/[./][A-Za-z0-9_-]+|[A-Za-z_$][\w$]*\(|@[a-z0-9-]+\/|#[0-9]+/.test(normalized)) return false;
  if (normalized.length <= 80 && /[A-Za-z0-9_./-]/.test(normalized)) return false;
  return true;
}

export function formatRagResult(result: {
  type: string;
  title: string;
  sourceUrl: string;
  snippet: string;
  path?: string;
}): string {
  const location = result.path ? ` path=${result.path}` : '';
  return `[${result.type}] ${result.title}${location} source=${result.sourceUrl}\n${result.snippet}`;
}
