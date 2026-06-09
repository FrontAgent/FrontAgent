import type { AgentTask } from '@frontagent/shared';
import { describe, expect, it, vi } from 'vitest';
import type { AgentEvent } from '../types.js';
import { prepareTaskExecutionSetup } from './task-execution-setup.js';

function makeTask(description = 'Use skill text'): AgentTask {
  return {
    id: 'task-1',
    type: 'code',
    description,
    context: {
      workingDirectory: '/repo',
      relevantFiles: ['src/app.ts'],
      browserUrl: 'http://localhost:5173',
    },
  };
}

function makeContext() {
  return {
    collectedContext: {
      files: new Map<string, string>(),
      pageStructure: undefined,
      ragResults: undefined,
      skillContext: undefined,
      matchedSkillNames: [] as string[],
      memoryContext: undefined,
      metadata: {} as Record<string, unknown>,
    },
  };
}

function makeSetupDeps({ ragEnabled = true }: { ragEnabled?: boolean } = {}) {
  const events: AgentEvent[] = [];
  const statusUpdates: Array<{ label: string; operation?: string; detail?: string }> = [];
  const context = makeContext();
  const createdTasks: AgentTask[] = [];
  const preloadMemory = vi.fn();
  const prepareProjectPlanningContext = vi.fn(
    async ({ deps }: { deps: { emitStatus: typeof emitStatus } }) => {
      deps.emitStatus('扫描项目结构', 'list_directory 扫描项目结构');
      deps.emitStatus('检测开发服务器端口', '检测开发服务器端口');
      deps.emitStatus('检索知识库', 'RAG 检索');
      return {
        projectStructure: 'project files',
        devServerPort: 5173,
        ragResults: ['rag result'],
        ragEvent: {
          searchMode: 'keyword_only' as const,
          matches: [
            {
              type: 'doc',
              title: 'Guide',
              sourceUrl: 'https://example.test',
              snippet: 'Use it.',
            },
          ],
        },
      };
    },
  );
  const emit = vi.fn((event: AgentEvent) => {
    events.push(event);
  });
  const emitStatus = vi.fn((label: string, operation = label, detail?: string) => {
    statusUpdates.push({ label, operation, detail });
    emit({ type: 'status_update', label, operation, detail });
  });
  const addMessage = vi.fn();
  const promptGenerator = { generate: vi.fn(() => 'sdd prompt') };
  const workflowIntegration = { getConstitutionPrompt: vi.fn(() => 'constitution prompt') };

  return {
    events,
    statusUpdates,
    context,
    createdTasks,
    preloadMemory,
    prepareProjectPlanningContext,
    addMessage,
    promptGenerator,
    workflowIntegration,
    deps: {
      config: {
        projectRoot: '/repo',
        llm: { provider: 'openai' as const, model: 'gpt-4', apiKey: 'test' },
        rag: ragEnabled
          ? { repoUrl: 'https://example.test/rag.git' }
          : { enabled: false, repoUrl: 'https://example.test/rag.git' },
      },
      contextManager: {
        createContext: vi.fn((task: AgentTask) => {
          createdTasks.push(task);
          return context;
        }),
        addMessage,
      },
      memoryStore: { resetSession: vi.fn() },
      memoryDeps: {},
      promptGenerator,
      workflowIntegration,
      planningDeps: {
        executor: { callTool: vi.fn() },
        ragDeps: {},
        emitStatus,
        debugLog: vi.fn(),
        debugWarn: vi.fn(),
      },
      preloadMemory,
      prepareProjectPlanningContext,
      emit,
      emitStatus,
      debugLog: vi.fn(),
    },
  };
}

describe('prepareTaskExecutionSetup', () => {
  it('prepares task inputs, status, memory, SDD prompts, and planning context in execute order', async () => {
    const setup = makeSetupDeps();
    const task = makeTask();

    const result = await prepareTaskExecutionSetup({
      task,
      originalTaskDescription: 'Use @skill-a for this',
      skillContext: 'skill prompt',
      matchedSkillNames: ['skill-a'],
      deps: setup.deps,
    });

    expect(result.task).toBe(task);
    expect(result.context).toBe(setup.context);
    expect(result.skillContext).toBe('skill prompt');
    expect(result.matchedSkillNames).toEqual(['skill-a']);
    expect(result.planningPreparation).toMatchObject({
      projectStructure: 'project files',
      devServerPort: 5173,
      ragResults: ['rag result'],
    });
    expect(setup.context.collectedContext.skillContext).toBe('skill prompt');
    expect(setup.context.collectedContext.matchedSkillNames).toEqual(['skill-a']);
    expect(setup.context.collectedContext.metadata.originalTaskDescription).toBe(
      'Use @skill-a for this',
    );
    expect(setup.deps.memoryStore.resetSession).toHaveBeenCalledOnce();
    expect(setup.preloadMemory).toHaveBeenCalledWith(
      setup.deps.memoryDeps,
      result.task.id,
      setup.context,
    );
    expect(setup.addMessage).toHaveBeenCalledWith(result.task.id, {
      role: 'system',
      content: 'constitution prompt',
    });
    expect(setup.addMessage).toHaveBeenCalledWith(result.task.id, {
      role: 'system',
      content: 'sdd prompt',
    });
    expect(setup.events.map((event) => event.type)).toEqual([
      'status_update',
      'status_update',
      'status_update',
      'status_update',
      'rag_retrieved',
    ]);
    expect(setup.statusUpdates.map((status) => [status.label, status.operation])).toEqual([
      ['加载跨会话记忆', '加载跨会话记忆'],
      ['扫描项目结构', 'list_directory 扫描项目结构'],
      ['检测开发服务器端口', '检测开发服务器端口'],
      ['检索知识库', 'RAG 检索'],
    ]);
  });

  it('keeps sanitized empty task descriptions from replacing the original and suppresses rag events when disabled', async () => {
    const setup = makeSetupDeps({ ragEnabled: false });
    const task = makeTask('Original task');

    const result = await prepareTaskExecutionSetup({
      task,
      originalTaskDescription: 'Original task',
      skillContext: 'skill prompt',
      matchedSkillNames: ['skill-a'],
      deps: setup.deps,
    });

    expect(result.task.description).toBe('Original task');
    expect(setup.prepareProjectPlanningContext).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: result.task.id,
        taskDescription: 'Original task',
        projectRoot: '/repo',
        ragEnabled: false,
        preScanFailureLabel: '[Agent] Failed to pre-scan project structure:',
        logProjectStructure: true,
      }),
    );
    expect(setup.events.some((event) => event.type === 'rag_retrieved')).toBe(false);
  });
});
