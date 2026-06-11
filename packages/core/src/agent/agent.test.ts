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
