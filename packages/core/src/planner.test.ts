import type { AgentTask } from '@frontagent/shared';
import { describe, expect, it } from 'vitest';
import { Planner } from './planner.js';

function createPlanner() {
  return new Planner({
    llm: {
      provider: 'openai',
      model: 'test-model',
      apiKey: 'test-key',
    },
  });
}

function createQueryTask(overrides: Partial<AgentTask> = {}): AgentTask {
  return {
    id: 'task-query',
    type: 'query',
    description: '读取 README.md 并总结',
    context: {
      workingDirectory: process.cwd(),
    },
    ...overrides,
  };
}

describe('Planner query tasks', () => {
  it('plans relevant files directly without shell steps', async () => {
    const planner = createPlanner();
    const result = await planner.plan(
      createQueryTask({
        context: {
          workingDirectory: process.cwd(),
          relevantFiles: ['README.md'],
        },
      }),
      { files: new Map() },
      [],
    );

    expect(result.plan?.steps).toHaveLength(1);
    expect(result.plan?.steps[0]).toMatchObject({
      action: 'read_file',
      tool: 'read_file',
      params: { path: 'README.md' },
      phase: '阶段1-分析',
    });
    expect(result.plan?.steps.some((step) => step.action === 'run_command')).toBe(false);
  });

  it('falls back to local code search when no explicit evidence source is provided', async () => {
    const planner = createPlanner();
    const result = await planner.plan(createQueryTask(), { files: new Map() }, []);

    expect(result.plan?.steps).toHaveLength(1);
    expect(result.plan?.steps[0]).toMatchObject({
      action: 'search_code',
      tool: 'search_code',
      params: { query: '读取 README.md 并总结', maxResults: 20 },
      phase: '阶段1-分析',
    });
  });
});
