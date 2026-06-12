import type { ExecutionStep } from '@frontagent/shared';
import { describe, expect, it } from 'vitest';
import { createAgent } from './agent.js';
import { generateOutput } from './answer-generation.js';

function makeStep(overrides: Partial<ExecutionStep> = {}): ExecutionStep {
  return {
    stepId: 'step-1',
    description: 'Create file',
    action: 'create_file',
    tool: 'create_file',
    params: { path: 'src/a.ts' },
    dependencies: [],
    validation: [],
    status: 'pending',
    phase: 'build',
    ...overrides,
  };
}

describe('generateOutput', () => {
  it('reports all steps completed', () => {
    const steps = [
      makeStep({ stepId: 's1', description: 'Create component', status: 'completed' }),
      makeStep({ stepId: 's2', description: 'Add styles', status: 'completed' }),
    ];
    const output = generateOutput(steps);
    expect(output).toContain('执行完成 (2/2 步骤成功)');
    expect(output).toContain('✅ Create component');
    expect(output).toContain('✅ Add styles');
  });

  it('reports partial completion', () => {
    const steps = [
      makeStep({ stepId: 's1', description: 'Create file', status: 'completed' }),
      makeStep({ stepId: 's2', description: 'Build project', status: 'failed' }),
    ];
    const output = generateOutput(steps);
    expect(output).toContain('执行完成 (1/2 步骤成功)');
    expect(output).toContain('✅ Create file');
    expect(output).not.toContain('✅ Build project');
  });

  it('reports zero completed steps', () => {
    const steps = [makeStep({ description: 'Do thing', status: 'failed' })];
    const output = generateOutput(steps);
    expect(output).toContain('执行完成 (0/1 步骤成功)');
  });

  it('handles empty steps', () => {
    const output = generateOutput([]);
    expect(output).toContain('执行完成 (0/0 步骤成功)');
  });
});

describe('createAgent', () => {
  it('creates a FrontAgent instance', () => {
    const agent = createAgent({
      projectRoot: '/test',
      llm: { provider: 'openai', model: 'gpt-4', apiKey: 'test-key' },
    });
    expect(agent).toBeDefined();
    expect(agent.getPlannerSkillSnapshot()).toBeDefined();
    expect(agent.getExecutorSkillSnapshot()).toBeDefined();
  });

  it('registers MCP client without error', () => {
    const agent = createAgent({
      projectRoot: '/test',
      llm: { provider: 'openai', model: 'gpt-4', apiKey: 'test-key' },
    });
    const client = {
      callTool: async () => ({}),
      listTools: async () => [],
    };
    agent.registerMCPClient('test', client);
  });

  it('adds and removes event listeners', () => {
    const agent = createAgent({
      projectRoot: '/test',
      llm: { provider: 'openai', model: 'gpt-4', apiKey: 'test-key' },
    });
    const listener = () => {};
    agent.addEventListener(listener);
    agent.removeEventListener(listener);
  });

  it('returns undefined session snapshot when no task is running', () => {
    const agent = createAgent({
      projectRoot: '/test',
      llm: { provider: 'openai', model: 'gpt-4', apiKey: 'test-key' },
    });
    expect(agent.getSessionSnapshot()).toBeUndefined();
  });

  it('accepts context budget configuration', () => {
    const agent = createAgent({
      projectRoot: '/test',
      llm: { provider: 'openai', model: 'gpt-4', apiKey: 'test-key' },
      contextBudget: {
        zoneBudgets: { memory: 8000 },
        historyCompaction: { threshold: 30, keepRecent: 10 },
      },
    });
    expect(agent).toBeDefined();
  });

  it('accepts declarative permission rules and a persist callback in security config', () => {
    const agent = createAgent({
      projectRoot: '/test',
      llm: { provider: 'openai', model: 'gpt-4', apiKey: 'test-key' },
      security: {
        interactive: true,
        permissions: { allow: ['run_command(pnpm test:*)'], deny: ['run_command(rm *)'] },
        approvalHandler: async () => ({ approved: true, alwaysAllow: true }),
        onPersistAllowRule: () => {},
      },
    });
    expect(agent).toBeDefined();
  });

  it('restores file context from a resume snapshot and skips completed steps', async () => {
    const agent = createAgent({
      projectRoot: '/test',
      llm: { provider: 'openai', model: 'gpt-4', apiKey: 'test-key' },
    });

    let midRunSnapshot: ReturnType<typeof agent.getSessionSnapshot>;
    agent.addEventListener((event) => {
      if (event.type === 'planning_completed') {
        midRunSnapshot = agent.getSessionSnapshot();
      }
    });

    // 计划里所有步骤均已完成：无需 MCP client，任何真实执行都会抛错
    const result = await agent.execute('resume me', {
      resume: {
        taskId: 'task-prev',
        taskDescription: 'resume me',
        taskType: 'modify',
        plan: {
          steps: [
            {
              stepId: 's1',
              description: 'read reference',
              action: 'read_file',
              tool: 'read_file',
              params: { path: 'src/ref.ts' },
              dependencies: [],
              validation: [],
              status: 'completed',
            },
          ],
          reasoning: 'plan',
          estimatedDuration: 1000,
        },
        messages: [{ role: 'user', content: 'earlier turn' }],
        files: { 'src/ref.ts': 'export const REF = 1;' },
      },
    });

    // 已完成步骤被跳过（未注册任何 MCP client 仍成功），文件上下文已恢复
    expect(result.success).toBe(true);
    expect(result.executedSteps[0]?.status).toBe('completed');
    expect(midRunSnapshot?.files).toMatchObject({ 'src/ref.ts': 'export const REF = 1;' });
    expect(midRunSnapshot?.messages.some((m) => m.content === 'earlier turn')).toBe(true);
  });

  it('returns planner and executor skill snapshots', () => {
    const agent = createAgent({
      projectRoot: '/test',
      llm: { provider: 'openai', model: 'gpt-4', apiKey: 'test-key' },
    });
    const plannerSnap = agent.getPlannerSkillSnapshot();
    const executorSnap = agent.getExecutorSkillSnapshot();
    expect(plannerSnap.taskSkills).toBeInstanceOf(Array);
    expect(executorSnap.actionSkills).toBeInstanceOf(Array);
  });
});
