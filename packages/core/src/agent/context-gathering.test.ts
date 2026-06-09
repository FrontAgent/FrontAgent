import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ContextManager } from '../context.js';
import type { Executor } from '../executor.js';
import type { LLMService } from '../llm.js';
import type { AgentConfig } from '../types.js';
import { gatherRequestedContext } from './context-gathering.js';
import type { RagRetrievalDeps } from './rag-retrieval.js';

function createDeps(toolResults: Record<string, unknown>): {
  contextManager: Pick<ContextManager, 'addFile' | 'setPageStructure' | 'addRagResults'>;
  executor: Pick<Executor, 'callTool'>;
  ragDeps: RagRetrievalDeps;
  debugWarn: ReturnType<typeof vi.fn>;
  calls: string[];
} {
  const calls: string[] = [];
  const executor = {
    callTool: vi.fn(async (toolName: string, params: Record<string, unknown>) => {
      calls.push(`${toolName}:${JSON.stringify(params)}`);
      const result = toolResults[toolName];
      if (result instanceof Error) {
        throw result;
      }
      return result;
    }),
  };
  const contextManager = {
    addFile: vi.fn(),
    setPageStructure: vi.fn(),
    addRagResults: vi.fn(),
  };
  const debugWarn = vi.fn();
  const ragDeps: RagRetrievalDeps = {
    config: {
      projectRoot: '/repo',
      llm: { provider: 'openai', model: 'gpt-4', apiKey: 'test' },
      rag: { queryRewrite: { mode: 'never' } },
    } as AgentConfig,
    executor: executor as Pick<Executor, 'callTool'> as Executor,
    llmService: {} as LLMService,
    contextManager: contextManager as Pick<
      ContextManager,
      'addFile' | 'setPageStructure' | 'addRagResults'
    > as ContextManager,
    debugLog: vi.fn(),
    debugWarn,
  };

  return { contextManager, executor, ragDeps, debugWarn, calls };
}

describe('gatherRequestedContext', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('stores file content returned by read_file requests', async () => {
    const deps = createDeps({
      read_file: { success: true, content: 'export const value = 1;' },
    });

    await gatherRequestedContext({
      taskId: 'task-1',
      requests: [{ type: 'read_file', params: { path: 'src/index.ts' } }],
      executor: deps.executor as Pick<Executor, 'callTool'> as Executor,
      contextManager: deps.contextManager as Pick<
        ContextManager,
        'addFile' | 'setPageStructure' | 'addRagResults'
      > as ContextManager,
      ragDeps: deps.ragDeps,
      debugWarn: deps.debugWarn,
    });

    expect(deps.executor.callTool).toHaveBeenCalledWith('read_file', { path: 'src/index.ts' });
    expect(deps.contextManager.addFile).toHaveBeenCalledWith(
      'task-1',
      'src/index.ts',
      'export const value = 1;',
    );
  });

  it('captures page structure after navigating to requested page', async () => {
    const pageStructure = { title: 'Home', nodes: [] };
    const deps = createDeps({
      browser_navigate: { success: true },
      get_page_structure: pageStructure,
    });

    await gatherRequestedContext({
      taskId: 'task-1',
      requests: [{ type: 'get_page', params: { url: 'http://localhost:3000' } }],
      executor: deps.executor as Pick<Executor, 'callTool'> as Executor,
      contextManager: deps.contextManager as Pick<
        ContextManager,
        'addFile' | 'setPageStructure' | 'addRagResults'
      > as ContextManager,
      ragDeps: deps.ragDeps,
      debugWarn: deps.debugWarn,
    });

    expect(deps.calls).toEqual([
      'browser_navigate:{"url":"http://localhost:3000"}',
      'get_page_structure:{}',
    ]);
    expect(deps.contextManager.setPageStructure).toHaveBeenCalledWith('task-1', pageStructure);
  });

  it('normalizes rag_query text and stores formatted results', async () => {
    const deps = createDeps({
      rag_query: {
        success: true,
        results: [
          {
            type: 'doc',
            title: 'Context docs',
            sourceUrl: 'https://example.test/context',
            snippet: 'Use gathered context during planning.',
            path: 'docs/context.md',
          },
        ],
      },
    });

    await gatherRequestedContext({
      taskId: 'task-1',
      requests: [{ type: 'rag_query', params: { query: '"context docs"', maxResults: 3 } }],
      executor: deps.executor as Pick<Executor, 'callTool'> as Executor,
      contextManager: deps.contextManager as Pick<
        ContextManager,
        'addFile' | 'setPageStructure' | 'addRagResults'
      > as ContextManager,
      ragDeps: deps.ragDeps,
      debugWarn: deps.debugWarn,
    });

    expect(deps.executor.callTool).toHaveBeenCalledWith('rag_query', {
      query: 'context docs',
      maxResults: 3,
    });
    expect(deps.contextManager.addRagResults).toHaveBeenCalledWith('task-1', [
      '[doc] Context docs path=docs/context.md source=https://example.test/context\nUse gathered context during planning.',
    ]);
  });

  it('warns on failed requests and continues gathering later requests', async () => {
    const deps = createDeps({
      read_file: new Error('read failed'),
      get_page_structure: { title: 'Recovered' },
      browser_navigate: { success: true },
    });

    await gatherRequestedContext({
      taskId: 'task-1',
      requests: [
        { type: 'read_file', params: { path: 'missing.ts' } },
        { type: 'get_page', params: { url: 'http://localhost:3000' } },
      ],
      executor: deps.executor as Pick<Executor, 'callTool'> as Executor,
      contextManager: deps.contextManager as Pick<
        ContextManager,
        'addFile' | 'setPageStructure' | 'addRagResults'
      > as ContextManager,
      ragDeps: deps.ragDeps,
      debugWarn: deps.debugWarn,
    });

    expect(deps.debugWarn).toHaveBeenCalledWith(
      'Failed to gather context: read_file',
      expect.any(Error),
    );
    expect(deps.contextManager.setPageStructure).toHaveBeenCalledWith('task-1', {
      title: 'Recovered',
    });
  });
});
