import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prepareProjectPlanningContext } from './project-prescan-preparation.js';
import { retrieveRagContext } from './rag-retrieval.js';

vi.mock('./rag-retrieval.js', () => ({
  retrieveRagContext: vi.fn(),
}));

describe('prepareProjectPlanningContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('prepares project structure, config contents, dev server port, and RAG context', async () => {
    vi.mocked(retrieveRagContext).mockResolvedValue({
      formattedResults: ['[doc] Prescan source=https://example.test\nUse shared context.'],
      matches: [
        {
          type: 'doc',
          title: 'Prescan',
          sourceUrl: 'https://example.test',
          snippet: 'Use shared context.',
        },
      ],
      searchMode: 'hybrid',
      reranked: true,
      warnings: ['cache warmup'],
      timing: { totalMs: 12 },
    });

    const toolCalls: Array<{ name: string; params: Record<string, unknown> }> = [];
    const executor = {
      callTool: vi.fn(async (name: string, params: Record<string, unknown>) => {
        toolCalls.push({ name, params });

        if (name === 'list_directory') {
          return {
            success: true,
            entries: [
              { name: 'App.tsx', type: 'file', path: 'src/App.tsx' },
              { name: 'package.json', type: 'file', path: 'package.json' },
              { name: 'vite.config.ts', type: 'file', path: 'vite.config.ts' },
              { name: 'ignored.js', type: 'file', path: 'node_modules/pkg/ignored.js' },
              { name: 'config', type: 'file', path: '.git/config' },
              { name: 'src', type: 'directory', path: 'src' },
            ],
          };
        }

        if (name === 'read_file' && params.path === 'package.json') {
          return {
            success: true,
            content: JSON.stringify({ scripts: { dev: 'vite --port 3001' } }),
          };
        }

        if (name === 'read_file' && params.path === 'vite.config.ts') {
          return { success: true, content: 'export default { server: { port: 4321 } }' };
        }

        throw new Error(`Unexpected tool call: ${name}`);
      }),
    };
    const statuses: Array<{ label: string; operation?: string }> = [];
    const warnings: unknown[][] = [];

    const result = await prepareProjectPlanningContext({
      deps: {
        executor,
        ragDeps: {
          config: { projectRoot: '/repo', llm: { provider: 'openai', model: 'gpt-4' } },
          executor: executor as never,
          llmService: {} as never,
          contextManager: {} as never,
          debugLog: () => {},
          debugWarn: () => {},
        },
        emitStatus: (label, operation) => statuses.push({ label, operation }),
        debugLog: () => {},
        debugWarn: (...args) => warnings.push(args),
      },
      taskId: 'task-1',
      taskDescription: 'Build a shared project prescan helper',
      projectRoot: '/repo',
      ragEnabled: true,
      preScanFailureLabel: '[Agent] Failed to pre-scan project structure:',
      logProjectStructure: true,
    });

    expect(statuses.map((status) => status.label)).toEqual([
      '扫描项目结构',
      '检测开发服务器端口',
      '检索知识库',
    ]);
    expect(statuses.map((status) => status.operation)).toEqual([
      'list_directory 扫描项目结构',
      '检测开发服务器端口',
      'RAG 检索',
    ]);

    expect(toolCalls).toEqual([
      { name: 'list_directory', params: { path: '/repo', recursive: true } },
      { name: 'read_file', params: { path: 'package.json' } },
      { name: 'read_file', params: { path: 'vite.config.ts' } },
    ]);

    expect(result.projectStructure).toContain('项目文件列表（共 3 个文件）');
    expect(result.projectStructure).toContain('src/App.tsx');
    expect(result.projectStructure).toContain('package.json');
    expect(result.projectStructure).toContain('vite.config.ts');
    expect(result.projectStructure).not.toContain('node_modules');
    expect(result.projectStructure).not.toContain('.git/config');
    expect(result.devServerPort).toBe(4321);
    expect(result.ragResults).toEqual([
      '[doc] Prescan source=https://example.test\nUse shared context.',
    ]);
    expect(result.ragEvent).toEqual({
      searchMode: 'hybrid',
      reranked: true,
      warnings: ['cache warmup'],
      timing: { totalMs: 12 },
      matches: [
        {
          type: 'doc',
          title: 'Prescan',
          sourceUrl: 'https://example.test',
          snippet: 'Use shared context.',
        },
      ],
    });
    expect(retrieveRagContext).toHaveBeenCalledWith(
      expect.any(Object),
      'task-1',
      'Build a shared project prescan helper',
    );
    expect(warnings).toEqual([]);
  });
});
