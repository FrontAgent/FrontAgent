import type { AgentTask } from '@frontagent/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Planner } from './planner.js';
import type { PlannerContextSnapshot } from './skills/index.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

function createPlanner(overrides: Partial<ConstructorParameters<typeof Planner>[0]> = {}) {
  return new Planner({
    llm: {
      provider: 'openai',
      model: 'test-model',
      apiKey: 'test-key',
    },
    ...overrides,
  });
}

function createTask(overrides: Partial<AgentTask> = {}): AgentTask {
  return {
    id: 'task-1',
    type: 'create',
    description: '创建一个新的工具函数',
    context: {
      workingDirectory: '/project',
    },
    ...overrides,
  };
}

function emptyContext(overrides: Partial<PlannerContextSnapshot> = {}): PlannerContextSnapshot {
  return {
    files: new Map(),
    ...overrides,
  };
}

// ─── Mock LLM generatePlan ──────────────────────────────────────────────────

function mockLLMGeneratePlan(planner: Planner, mockFn: (...args: unknown[]) => unknown) {
  const llmService = planner.getLLMService();
  vi.spyOn(llmService, 'generatePlan').mockImplementation(mockFn as never);
}

/** Default step params to reduce verbosity in mock LLM responses */
function defaultParams(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    path: '', recursive: false, query: '', pattern: '', filePattern: '',
    globOnly: false, maxResults: 0, directory: '', command: '', url: '',
    selector: '', text: '', fullPage: false, codeDescription: '', changeDescription: '',
    ...overrides,
  };
}

// ─── Tests: Query task planning (rule-based) ────────────────────────────────

describe('Planner query tasks', () => {
  it('plans relevant files directly without shell steps', async () => {
    const planner = createPlanner();
    const result = await planner.plan(
      createTask({
        id: 'task-query',
        type: 'query',
        description: '读取 README.md 并总结',
        context: { workingDirectory: '/project', relevantFiles: ['README.md'] },
      }),
      emptyContext(),
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
    const result = await planner.plan(
      createTask({
        id: 'task-query',
        type: 'query',
        description: '读取 README.md 并总结',
        context: { workingDirectory: '/project' },
      }),
      emptyContext(),
      [],
    );

    expect(result.plan?.steps).toHaveLength(1);
    expect(result.plan?.steps[0]).toMatchObject({
      action: 'search_code',
      tool: 'search_code',
      params: { query: '读取 README.md 并总结', maxResults: 20 },
      phase: '阶段1-分析',
    });
  });

  it('adds browser steps when browserUrl is provided and pageStructure exists', async () => {
    const planner = createPlanner();
    const result = await planner.plan(
      createTask({
        type: 'query',
        description: '检查页面状态',
        context: { workingDirectory: '/project', browserUrl: 'http://localhost:3000' },
      }),
      emptyContext({ pageStructure: { tag: 'body' } }),
      [],
    );

    const steps = result.plan!.steps;
    expect(steps.some((s) => s.action === 'browser_navigate')).toBe(true);
    expect(steps.some((s) => s.action === 'get_page_structure')).toBe(true);
  });
});
// PLACEHOLDER_CHUNK3

// ─── Tests: Plan generation with LLM (mocked) ──────────────────────────────

describe('Planner LLM-based plan generation', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('generates plan from LLM response and converts steps correctly', async () => {
    const planner = createPlanner({ useLLM: true });
    mockLLMGeneratePlan(planner, async () => ({
      summary: '创建工具函数',
      steps: [
        {
          description: '读取目标目录',
          action: 'list_directory',
          tool: 'list_directory',
          phase: '阶段1-分析',
          params: defaultParams({ path: 'src/utils' }),
          reasoning: '了解目录结构',
          needsCodeGeneration: false,
        },
        {
          description: '创建工具函数文件',
          action: 'create_file',
          tool: 'create_file',
          phase: '阶段2-创建',
          params: defaultParams({ path: 'src/utils/helper.ts', codeDescription: '创建工具函数' }),
          reasoning: '创建新文件',
          needsCodeGeneration: true,
        },
      ],
      risks: [],
      alternatives: [],
    }));

    const result = await planner.plan(
      createTask({ type: 'create' }),
      emptyContext(),
      [],
    );

    expect(result.needsMoreContext).toBe(false);
    expect(result.plan).toBeDefined();
    const listStep = result.plan!.steps.find((s) => s.action === 'list_directory');
    const createStep = result.plan!.steps.find((s) => s.action === 'create_file');
    expect(listStep).toBeDefined();
    expect(createStep).toBeDefined();
  });

  it('falls back to rule-based planning when LLM throws an error', async () => {
    const planner = createPlanner({ useLLM: true });
    mockLLMGeneratePlan(planner, async () => {
      throw new Error('API rate limit exceeded');
    });

    const result = await planner.plan(
      createTask({
        type: 'create',
        context: { workingDirectory: '/project', relevantFiles: ['src/new-file.ts'] },
      }),
      emptyContext(),
      [],
    );

    expect(result.plan).toBeDefined();
    expect(result.plan!.steps.length).toBeGreaterThan(0);
    expect(result.fallbackReason).toBe('API rate limit exceeded');
  });

  it('skips LLM when useLLM is false', async () => {
    const planner = createPlanner({ useLLM: false });
    const spy = vi.fn();
    mockLLMGeneratePlan(planner, spy);

    await planner.plan(createTask({ type: 'create' }), emptyContext(), []);

    expect(spy).not.toHaveBeenCalled();
  });
});
// PLACEHOLDER_CHUNK4

// ─── Tests: Step ordering and dependency resolution ─────────────────────────

describe('Planner step ordering and dependencies', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates sequential dependencies between non-read-only steps', async () => {
    const planner = createPlanner({ useLLM: true });
    mockLLMGeneratePlan(planner, async () => ({
      summary: '修改文件',
      steps: [
        {
          description: '读取文件',
          action: 'read_file',
          tool: 'read_file',
          phase: '阶段1-分析',
          params: defaultParams({ path: 'src/index.ts' }),
          reasoning: '读取源文件',
          needsCodeGeneration: false,
        },
        {
          description: '修改文件',
          action: 'apply_patch',
          tool: 'apply_patch',
          phase: '阶段2-修改',
          params: defaultParams({ path: 'src/index.ts', changeDescription: '添加导出' }),
          reasoning: '应用修改',
          needsCodeGeneration: true,
        },
        {
          description: '运行测试',
          action: 'run_command',
          tool: 'run_command',
          phase: '阶段4-验证',
          params: defaultParams({ command: 'pnpm test' }),
          reasoning: '验证修改',
          needsCodeGeneration: false,
        },
      ],
      risks: [],
      alternatives: [],
    }));

    const result = await planner.plan(createTask({ type: 'modify' }), emptyContext(), []);

    const steps = result.plan!.steps;
    const readStep = steps.find((s) => s.action === 'read_file');
    const patchStep = steps.find((s) => s.action === 'apply_patch');
    const runStep = steps.find((s) => s.action === 'run_command' && s.params.command === 'pnpm test');

    expect(patchStep!.dependencies).toContain(readStep!.stepId);
    expect(runStep!.dependencies).toContain(patchStep!.stepId);
  });
// PLACEHOLDER_CHUNK5

  it('allows parallel execution of consecutive read-only steps (no dependency)', async () => {
    const planner = createPlanner({ useLLM: true });
    mockLLMGeneratePlan(planner, async () => ({
      summary: '分析代码',
      steps: [
        {
          description: '读取文件A',
          action: 'read_file',
          tool: 'read_file',
          phase: '阶段1-分析',
          params: defaultParams({ path: 'a.ts' }),
          reasoning: '读取A',
          needsCodeGeneration: false,
        },
        {
          description: '搜索代码',
          action: 'search_code',
          tool: 'search_code',
          phase: '阶段1-分析',
          params: defaultParams({ query: 'function', maxResults: 10 }),
          reasoning: '搜索相关代码',
          needsCodeGeneration: false,
        },
      ],
      risks: [],
      alternatives: [],
    }));

    const result = await planner.plan(createTask({ type: 'create' }), emptyContext(), []);

    const steps = result.plan!.steps;
    const readStep = steps.find((s) => s.action === 'read_file' && s.params.path === 'a.ts');
    const searchStep = steps.find((s) => s.action === 'search_code');
    expect(readStep).toBeDefined();
    expect(searchStep).toBeDefined();
    expect(searchStep!.dependencies).not.toContain(readStep!.stepId);
  });

  it('generates correct dependencies for modify task (rule-based)', async () => {
    const planner = createPlanner({ useLLM: false });
    const result = await planner.plan(
      createTask({
        type: 'modify',
        context: { workingDirectory: '/project', relevantFiles: ['src/app.ts'] },
      }),
      emptyContext({ files: new Map([['src/app.ts', 'export const x = 1;']]) }),
      [],
    );

    const steps = result.plan!.steps;
    const astStep = steps.find((s) => s.action === 'get_ast');
    const patchStep = steps.find((s) => s.action === 'apply_patch');

    expect(astStep).toBeDefined();
    expect(patchStep).toBeDefined();
    expect(patchStep!.dependencies).toContain(astStep!.stepId);
  });
});
// PLACEHOLDER_CHUNK6

// ─── Tests: Error handling ──────────────────────────────────────────────────

describe('Planner error handling', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns null plan (rejection) when LLM returns empty steps and rule-based also yields nothing', async () => {
    const planner = createPlanner({ useLLM: true });
    mockLLMGeneratePlan(planner, async () => ({
      summary: '',
      steps: [],
      risks: [],
      alternatives: [],
    }));

    const result = await planner.plan(
      createTask({
        type: 'test',
        description: '运行测试',
        context: { workingDirectory: '/project' },
      }),
      emptyContext(),
      [],
    );

    expect(result.plan).toBeUndefined();
    expect(result.rejectionReason).toBe('无法生成有效的执行计划');
  });

  it('handles non-Error thrown from LLM gracefully', async () => {
    const planner = createPlanner({ useLLM: true });
    mockLLMGeneratePlan(planner, async () => {
      throw 'string error without Error wrapper';
    });

    const result = await planner.plan(
      createTask({
        type: 'create',
        context: { workingDirectory: '/project', relevantFiles: ['src/new.ts'] },
      }),
      emptyContext(),
      [],
    );

    expect(result.plan).toBeDefined();
    expect(result.fallbackReason).toBe('string error without Error wrapper');
  });

  it('maps unknown LLM action to read_file as safe default', async () => {
    const planner = createPlanner({ useLLM: true });
    mockLLMGeneratePlan(planner, async () => ({
      summary: '执行未知操作',
      steps: [
        {
          description: '未知操作',
          action: 'unknown_action_xyz',
          tool: 'unknown_tool',
          phase: '阶段1-分析',
          params: defaultParams({ path: 'x.ts' }),
          reasoning: '测试未知action',
          needsCodeGeneration: false,
        },
      ],
      risks: [],
      alternatives: [],
    }));

    const result = await planner.plan(createTask({ type: 'create' }), emptyContext(), []);

    const step = result.plan!.steps[0];
    expect(step.action).toBe('read_file');
  });
// PLACEHOLDER_CHUNK7

  it('requests more context when modify task has unread relevant files', async () => {
    const planner = createPlanner({ useLLM: false });
    const result = await planner.plan(
      createTask({
        type: 'modify',
        context: { workingDirectory: '/project', relevantFiles: ['src/unread-file.ts'] },
      }),
      emptyContext(),
      [],
    );

    expect(result.needsMoreContext).toBe(true);
    expect(result.contextRequests).toBeDefined();
    expect(result.contextRequests!.length).toBeGreaterThan(0);
    expect(result.contextRequests![0]).toMatchObject({
      type: 'read_file',
      params: { path: 'src/unread-file.ts' },
    });
  });

  it('requests page structure when browserUrl is set but pageStructure is missing', async () => {
    const planner = createPlanner({ useLLM: false });
    const result = await planner.plan(
      createTask({
        type: 'modify',
        context: { workingDirectory: '/project', browserUrl: 'http://localhost:3000' },
      }),
      emptyContext(),
      [],
    );

    expect(result.needsMoreContext).toBe(true);
    expect(result.contextRequests!.some((r) => r.type === 'get_page')).toBe(true);
  });
});
// PLACEHOLDER_CHUNK8

// ─── Tests: Edge cases ──────────────────────────────────────────────────────

describe('Planner edge cases', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('handles single-step plan correctly', async () => {
    const planner = createPlanner({ useLLM: true });
    mockLLMGeneratePlan(planner, async () => ({
      summary: '单步计划',
      steps: [
        {
          description: '读取配置文件',
          action: 'read_file',
          tool: 'read_file',
          phase: '阶段1-分析',
          params: defaultParams({ path: 'config.json' }),
          reasoning: '读取配置',
          needsCodeGeneration: false,
        },
      ],
      risks: [],
      alternatives: [],
    }));

    const result = await planner.plan(createTask({ type: 'query' }), emptyContext(), []);

    expect(result.plan).toBeDefined();
    expect(result.plan!.steps.length).toBe(1);
    expect(result.plan!.steps[0].dependencies).toEqual([]);
  });

  it('generates plan summary with action counts', async () => {
    const planner = createPlanner({ useLLM: false });
    const result = await planner.plan(
      createTask({
        type: 'modify',
        context: { workingDirectory: '/project', relevantFiles: ['a.ts'] },
      }),
      emptyContext({ files: new Map([['a.ts', 'content']]) }),
      [],
    );

    const summary = result.plan!.summary;
    expect(summary).toContain('modify');
    expect(summary).toContain('步骤数:');
  });

  it('sets rollback strategy for modify tasks', async () => {
    const planner = createPlanner({ useLLM: false });
    const result = await planner.plan(
      createTask({
        type: 'modify',
        context: { workingDirectory: '/project', relevantFiles: ['a.ts'] },
      }),
      emptyContext({ files: new Map([['a.ts', 'content']]) }),
      [],
    );

    expect(result.plan!.rollbackStrategy).toEqual({
      enabled: true,
      snapshotBeforeExecution: true,
      rollbackOnFailure: true,
      maxRollbackSteps: 10,
    });
  });
// PLACEHOLDER_CHUNK9

  it('disables rollback for query tasks', async () => {
    const planner = createPlanner({ useLLM: false });
    const result = await planner.plan(
      createTask({
        type: 'query',
        description: '查询信息',
        context: { workingDirectory: '/project', relevantFiles: ['readme.md'] },
      }),
      emptyContext(),
      [],
    );

    expect(result.plan!.rollbackStrategy.enabled).toBe(false);
  });

  it('estimates duration based on step count', async () => {
    const planner = createPlanner({ useLLM: false });
    const result = await planner.plan(
      createTask({
        type: 'query',
        context: { workingDirectory: '/project', relevantFiles: ['a.ts', 'b.ts', 'c.ts'] },
      }),
      emptyContext(),
      [],
    );

    const stepCount = result.plan!.steps.length;
    expect(result.plan!.estimatedDuration).toBe(stepCount * 2000);
  });

  it('does not inject repository management phase for query tasks', async () => {
    const planner = createPlanner({ useLLM: false });
    const result = await planner.plan(
      createTask({
        type: 'query',
        context: { workingDirectory: '/project', relevantFiles: ['a.ts'] },
      }),
      emptyContext(),
      [],
    );

    const hasRepoPhase = result.plan!.steps.some(
      (s) => s.phase?.includes('仓库管理') || s.phase?.includes('repository'),
    );
    expect(hasRepoPhase).toBe(false);
  });
// PLACEHOLDER_CHUNK10

  it('injects repository management phase when plan has code changes and acceptance steps', async () => {
    const planner = createPlanner({ useLLM: true });
    mockLLMGeneratePlan(planner, async () => ({
      summary: '创建并验证',
      steps: [
        {
          description: '创建文件',
          action: 'create_file',
          tool: 'create_file',
          phase: '阶段2-创建',
          params: defaultParams({ path: 'src/new.ts', codeDescription: '新文件' }),
          reasoning: '创建',
          needsCodeGeneration: true,
        },
        {
          description: '运行类型检查',
          action: 'run_command',
          tool: 'run_command',
          phase: '阶段4-验证',
          params: defaultParams({ command: 'pnpm typecheck' }),
          reasoning: '验证类型',
          needsCodeGeneration: false,
        },
      ],
      risks: [],
      alternatives: [],
    }));

    const result = await planner.plan(createTask({ type: 'create' }), emptyContext(), []);

    const repoSteps = result.plan!.steps.filter((s) => s.phase?.includes('仓库管理'));
    expect(repoSteps.length).toBeGreaterThan(0);
  });

  it('does not duplicate repository management phase if LLM already included it', async () => {
    const planner = createPlanner({ useLLM: true });
    mockLLMGeneratePlan(planner, async () => ({
      summary: '创建并提交',
      steps: [
        {
          description: '创建文件',
          action: 'create_file',
          tool: 'create_file',
          phase: '阶段2-创建',
          params: defaultParams({ path: 'src/new.ts', codeDescription: '新文件' }),
          reasoning: '创建',
          needsCodeGeneration: true,
        },
        {
          description: '提交代码',
          action: 'run_command',
          tool: 'run_command',
          phase: '阶段7-仓库管理',
          params: defaultParams({ command: 'git commit -m "feat: add new file"' }),
          reasoning: '提交',
          needsCodeGeneration: false,
        },
      ],
      risks: [],
      alternatives: [],
    }));

    const result = await planner.plan(createTask({ type: 'create' }), emptyContext(), []);

    const repoSteps = result.plan!.steps.filter((s) => s.phase?.includes('仓库管理'));
    expect(repoSteps.length).toBeLessThanOrEqual(1);
  });
});
// PLACEHOLDER_CHUNK11

// ─── Tests: Skill registration ──────────────────────────────────────────────

describe('Planner skill registration', () => {
  it('exposes skill layer snapshot', () => {
    const planner = createPlanner();
    const snapshot = planner.getSkillLayerSnapshot();
    expect(snapshot.taskSkills).toBeDefined();
    expect(snapshot.phaseSkills).toBeDefined();
    expect(Array.isArray(snapshot.taskSkills)).toBe(true);
    expect(Array.isArray(snapshot.phaseSkills)).toBe(true);
  });

  it('allows registering custom task skill', async () => {
    const planner = createPlanner({ useLLM: false });
    planner.registerTaskSkill({
      name: 'custom-skill',
      supports: (task) => task.type === 'query' && task.description.includes('custom'),
      plan: ({ stepFactory }) => [
        stepFactory.createStep({
          description: 'Custom step',
          action: 'search_code',
          tool: 'search_code',
          params: { query: 'custom' },
        }),
      ],
    });

    const result = await planner.plan(
      createTask({
        type: 'query',
        description: 'custom query task',
        context: { workingDirectory: '/project' },
      }),
      emptyContext(),
      [],
    );

    expect(result.plan!.steps.some((s) => s.description === 'Custom step')).toBe(true);
  });
});

// ─── Tests: Configuration updates ──────────────────────────────────────────

describe('Planner configuration', () => {
  it('updates SDD config', () => {
    const planner = createPlanner();
    expect(() =>
      planner.updateSDDConfig({ contracts: [], invariants: [] }),
    ).not.toThrow();
  });

  it('updates LLM config', () => {
    const planner = createPlanner();
    expect(() => planner.updateLLMConfig({ temperature: 0.5 })).not.toThrow();
  });

  it('createPlanner factory function works', async () => {
    const { createPlanner: factory } = await import('./planner.js');
    const planner = factory({
      llm: { provider: 'openai', model: 'gpt-4', apiKey: 'key' },
    });
    expect(planner).toBeInstanceOf(Planner);
  });
});
