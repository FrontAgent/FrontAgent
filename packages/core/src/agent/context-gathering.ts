import type { ContextManager } from '../context.js';
import type { Executor } from '../executor.js';
import { mergeRetrievalQuery, normalizeSearchQuery } from './helpers.js';
import {
  formatRagResult,
  type RagRetrievalDeps,
  rewriteRagQueryForRetrieval,
} from './rag-retrieval.js';

export interface ContextGatheringRequest {
  type: string;
  params: Record<string, unknown>;
}

export interface ContextGatheringDeps {
  taskId: string;
  requests: ContextGatheringRequest[];
  executor: Executor;
  contextManager: ContextManager;
  ragDeps: RagRetrievalDeps;
  debugWarn: (...args: unknown[]) => void;
}

export async function gatherRequestedContext({
  taskId,
  requests,
  executor,
  contextManager,
  ragDeps,
  debugWarn,
}: ContextGatheringDeps): Promise<void> {
  for (const request of requests) {
    try {
      switch (request.type) {
        case 'read_file': {
          const path = request.params.path as string;
          const result = await executor.callTool('read_file', { path });
          if ((result as { success?: boolean }).success) {
            contextManager.addFile(taskId, path, (result as { content: string }).content);
          }
          break;
        }
        case 'get_page': {
          const url = request.params.url as string;
          await executor.callTool('browser_navigate', { url });
          const result = await executor.callTool('get_page_structure', {});
          contextManager.setPageStructure(taskId, result);
          break;
        }
        case 'rag_query': {
          const query = request.params.query as string;
          const maxResults = request.params.maxResults as number | undefined;
          const rewrittenQuery = await rewriteRagQueryForRetrieval(ragDeps, query);
          const retrievalQuery = rewrittenQuery
            ? mergeRetrievalQuery(query, rewrittenQuery)
            : normalizeSearchQuery(query);
          const result = (await executor.callTool('rag_query', {
            query: retrievalQuery,
            maxResults,
          })) as {
            success?: boolean;
            results?: Array<{
              type: string;
              title: string;
              sourceUrl: string;
              snippet: string;
              path?: string;
            }>;
          };

          if (result.success && result.results?.length) {
            contextManager.addRagResults(
              taskId,
              result.results.map((item) => formatRagResult(item)),
            );
          }
          break;
        }
      }
    } catch (error) {
      debugWarn(`Failed to gather context: ${request.type}`, error);
    }
  }
}
