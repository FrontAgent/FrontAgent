import { describe, expect, it, vi } from 'vitest';
import type { PlanGenerationDeps } from './plan-generation.js';
import { generatePlan, generatePlanInTwoPhases, normalizePlan } from './plan-generation.js';

const noopDeps: PlanGenerationDeps = {
  debugLog: () => {},
  debugWarn: () => {},
  debugError: () => {},
  generateObject: async () => ({}) as never,
};

const baseOptions = {
  task: 'Add a feature',
  context: 'project context',
};

const emptyParams = {
  path: '',
  recursive: false,
  query: '',
  pattern: '',
  filePattern: '',
  globOnly: false,
  maxResults: 0,
  directory: '',
  command: '',
  url: '',
  selector: '',
  text: '',
  fullPage: false,
  codeDescription: '',
  changeDescription: '',
};

function makeDetailStep(
  overrides: Partial<{
    description: string;
    action: string;
    tool: string;
    phase: string;
    params: Record<string, unknown>;
    reasoning: string;
    needsCodeGeneration: boolean;
  }> = {},
) {
  return {
    description: 'detailed step',
    action: 'create_file',
    tool: 'create_file',
    phase: '阶段2-创建',
    params: { ...emptyParams },
    reasoning: 'because needed',
    needsCodeGeneration: false,
    ...overrides,
  };
}

function buildDeps(generateObject: PlanGenerationDeps['generateObject']): {
  deps: PlanGenerationDeps;
  debugLog: ReturnType<typeof vi.fn>;
  debugWarn: ReturnType<typeof vi.fn>;
} {
  const debugLog = vi.fn();
  const debugWarn = vi.fn();
  return {
    deps: {
      debugLog,
      debugWarn,
      debugError: () => {},
      generateObject,
    },
    debugLog,
    debugWarn,
  };
}

describe('normalizePlan', () => {
  it('passes through well-formed plan', () => {
    const raw = {
      summary: 'Test plan',
      steps: [
        {
          description: 'step 1',
          action: 'create_file',
          tool: 'write_file',
          phase: 'phase-1',
          params: { path: 'src/app.ts' },
          reasoning: 'needed',
          needsCodeGeneration: true,
        },
      ],
      risks: ['risk 1'],
      alternatives: ['alt 1'],
    };
    const result = normalizePlan(raw, noopDeps);
    expect(result.summary).toBe('Test plan');
    expect(result.steps).toHaveLength(1);
    expect(result.risks).toEqual(['risk 1']);
    expect(result.alternatives).toEqual(['alt 1']);
  });

  it('defaults summary when missing', () => {
    const result = normalizePlan({ steps: [], risks: [], alternatives: [] }, noopDeps);
    expect(result.summary).toBe('Generated Plan');
  });

  it('handles steps as string (malformed LLM output)', () => {
    const result = normalizePlan(
      { summary: 'plan', steps: 'not an array', risks: [], alternatives: [] },
      noopDeps,
    );
    expect(result.steps).toEqual([]);
  });

  it('parses stringified params in steps', () => {
    const raw = {
      summary: 'plan',
      steps: [
        {
          description: 'write',
          action: 'create_file',
          tool: 'write_file',
          phase: 'p1',
          params: '{"path":"src/x.ts"}',
          reasoning: 'r',
          needsCodeGeneration: false,
        },
      ],
      risks: [],
      alternatives: [],
    };
    const result = normalizePlan(raw, noopDeps);
    expect(result.steps[0].params).toEqual({ path: 'src/x.ts' });
  });

  it('wraps unparseable string params in value key', () => {
    const raw = {
      summary: 'plan',
      steps: [
        {
          description: 'write',
          action: 'create_file',
          tool: 'write_file',
          phase: 'p1',
          params: 'not json',
          reasoning: 'r',
          needsCodeGeneration: false,
        },
      ],
      risks: [],
      alternatives: [],
    };
    const result = normalizePlan(raw, noopDeps);
    expect(result.steps[0].params).toEqual({ value: 'not json' });
  });

  it('defaults null/undefined params to empty object', () => {
    const raw = {
      summary: 'plan',
      steps: [
        {
          description: 'write',
          action: 'create_file',
          tool: 'write_file',
          phase: 'p1',
          params: null,
          reasoning: 'r',
          needsCodeGeneration: false,
        },
      ],
      risks: [],
      alternatives: [],
    };
    const result = normalizePlan(raw, noopDeps);
    expect(result.steps[0].params).toEqual({});
  });

  it('coerces string needsCodeGeneration to boolean', () => {
    const raw = {
      summary: 'plan',
      steps: [
        {
          description: 'write',
          action: 'create_file',
          tool: 'write_file',
          phase: 'p1',
          params: {},
          reasoning: 'r',
          needsCodeGeneration: 'true',
        },
      ],
      risks: [],
      alternatives: [],
    };
    const result = normalizePlan(raw, noopDeps);
    expect(result.steps[0].needsCodeGeneration).toBe(true);
  });

  it('converts string risks to array', () => {
    const result = normalizePlan(
      { summary: 'plan', steps: [], risks: 'single risk', alternatives: [] },
      noopDeps,
    );
    expect(result.risks).toEqual(['single risk']);
  });

  it('converts string alternatives to array', () => {
    const result = normalizePlan(
      { summary: 'plan', steps: [], risks: [], alternatives: 'single alt' },
      noopDeps,
    );
    expect(result.alternatives).toEqual(['single alt']);
  });

  it('defaults non-array risks to empty array', () => {
    const result = normalizePlan(
      { summary: 'plan', steps: [], risks: 123, alternatives: [] },
      noopDeps,
    );
    expect(result.risks).toEqual([]);
  });

  it('defaults non-array alternatives to empty array', () => {
    const result = normalizePlan(
      { summary: 'plan', steps: [], risks: [], alternatives: null },
      noopDeps,
    );
    expect(result.alternatives).toEqual([]);
  });
});

describe('generatePlanInTwoPhases', () => {
  it('returns a GeneratedPlan from outline + detail phases, calling generateObject in order', async () => {
    const outline = {
      summary: 'Two-phase plan summary',
      stepOutlines: [
        { description: 'List project files', action: 'list_directory', phase: '阶段1-分析' },
        { description: 'Create new component', action: 'create_file', phase: '阶段2-创建' },
      ],
      risks: ['risk a'],
      alternatives: ['alt a'],
    };
    const detail = {
      steps: [
        makeDetailStep({
          description: 'List project files',
          action: 'list_directory',
          tool: 'list_directory',
          phase: '阶段1-分析',
        }),
        makeDetailStep({
          description: 'Create new component',
          action: 'create_file',
          tool: 'create_file',
          phase: '阶段2-创建',
          needsCodeGeneration: true,
        }),
      ],
    };

    const generateObject = vi.fn().mockResolvedValueOnce(outline).mockResolvedValueOnce(detail);
    const { deps } = buildDeps(generateObject);

    const result = await generatePlanInTwoPhases(baseOptions, deps);

    expect(generateObject).toHaveBeenCalledTimes(2);
    // Phase 1 call uses the PlanOutlineSchema-bound system prompt
    expect(generateObject.mock.calls[0][0].schema).toBeDefined();
    expect(result.summary).toBe('Two-phase plan summary');
    expect(result.steps).toHaveLength(2);
    expect(result.steps[0].phase).toBe('阶段1-分析');
    expect(result.steps[1].phase).toBe('阶段2-创建');
    expect(result.risks).toEqual(['risk a']);
    expect(result.alternatives).toEqual(['alt a']);
  });

  it('auto-fixes phase assignments when more than half of step outlines are ungrouped', async () => {
    // 4 steps total, 3 are ungrouped (missing or '未分组') -> > 50%, triggers auto-fix.
    const outline = {
      summary: 'Auto-fix summary',
      stepOutlines: [
        { description: '列出项目目录结构', action: 'list_directory', phase: '' },
        { description: '创建新组件文件', action: 'create_file', phase: '未分组' },
        { description: '安装依赖 install packages', action: 'run_command', phase: '' },
        { description: '保留阶段', action: 'apply_patch', phase: '阶段2-创建' },
      ],
      risks: [],
      alternatives: [],
    };
    const detail = {
      steps: outline.stepOutlines.map((s) =>
        makeDetailStep({ description: s.description, action: s.action, phase: s.phase }),
      ),
    };

    const generateObject = vi.fn().mockResolvedValueOnce(outline).mockResolvedValueOnce(detail);
    const { deps, debugWarn } = buildDeps(generateObject);

    await generatePlanInTwoPhases(baseOptions, deps);

    // Auto-fix should have warned about the ungrouped ratio.
    expect(debugWarn).toHaveBeenCalled();

    // list_directory -> 阶段1-分析
    expect(outline.stepOutlines[0].phase).toBe('阶段1-分析');
    // create_file -> 阶段2-创建
    expect(outline.stepOutlines[1].phase).toBe('阶段2-创建');
    // run_command with "安装"/"install" -> 阶段3-安装
    expect(outline.stepOutlines[2].phase).toBe('阶段3-安装');
    // already grouped step is left untouched
    expect(outline.stepOutlines[3].phase).toBe('阶段2-创建');
  });

  it('maps run_command verification, startup, and repo-management descriptions during auto-fix', async () => {
    const outline = {
      summary: 'Run command mapping',
      stepOutlines: [
        { description: '执行 tsc --noEmit 类型检查', action: 'run_command', phase: '' },
        { description: '执行 npm run dev 启动开发服务器', action: 'run_command', phase: '' },
        { description: '执行 git commit 并 gh pr create', action: 'run_command', phase: '' },
        { description: '执行其他未知命令', action: 'run_command', phase: '' },
      ],
      risks: [],
      alternatives: [],
    };
    const detail = {
      steps: outline.stepOutlines.map((s) =>
        makeDetailStep({ description: s.description, action: s.action, phase: s.phase }),
      ),
    };

    const generateObject = vi.fn().mockResolvedValueOnce(outline).mockResolvedValueOnce(detail);
    const { deps } = buildDeps(generateObject);

    await generatePlanInTwoPhases(baseOptions, deps);

    // 4/4 ungrouped -> 100% > 50%, auto-fix fires
    expect(outline.stepOutlines[0].phase).toBe('阶段4-验证'); // tsc --noEmit -> 验证
    expect(outline.stepOutlines[1].phase).toBe('阶段5-启动'); // npm run dev / 启动 -> 启动
    expect(outline.stepOutlines[2].phase).toBe('阶段7-仓库管理'); // git/gh -> 仓库管理
    expect(outline.stepOutlines[3].phase).toBe('阶段4-验证'); // fallback for run_command
  });

  it('leaves phases untouched when at most half of step outlines are ungrouped', async () => {
    // 4 steps total, 2 ungrouped -> exactly 50%, not > 50%, so auto-fix does not fire.
    const outline = {
      summary: 'No auto-fix summary',
      stepOutlines: [
        { description: '已分组步骤1', action: 'list_directory', phase: '阶段1-分析' },
        { description: '已分组步骤2', action: 'create_file', phase: '阶段2-创建' },
        { description: '未分组步骤1', action: 'search_code', phase: '' },
        { description: '未分组步骤2', action: 'run_command', phase: '未分组' },
      ],
      risks: [],
      alternatives: [],
    };
    const detail = {
      steps: outline.stepOutlines.map((s) =>
        makeDetailStep({
          description: s.description,
          action: s.action,
          phase: s.phase || '未分组',
        }),
      ),
    };

    const generateObject = vi.fn().mockResolvedValueOnce(outline).mockResolvedValueOnce(detail);
    const { deps, debugWarn } = buildDeps(generateObject);

    await generatePlanInTwoPhases(baseOptions, deps);

    // The auto-fix warning is only emitted when ungroupedCount > 50%.
    expect(debugWarn).not.toHaveBeenCalled();
    // Untouched phases remain as provided (empty / '未分组').
    expect(outline.stepOutlines[2].phase).toBe('');
    expect(outline.stepOutlines[3].phase).toBe('未分组');
  });

  it('auto-fix assigns read_file steps to 阶段1-分析 at all indices (i<10 special case and final fallback coincide)', async () => {
    // Build 12 steps: index 0-10 are read_file with empty phase (11 steps), index 11 is read_file too.
    // Total 12 steps, all ungrouped -> 100% > 50%, auto-fix fires.
    const stepOutlines = Array.from({ length: 12 }, (_, i) => ({
      description: `读取文件 ${i}`,
      action: 'read_file',
      phase: '',
    }));
    const outline = {
      summary: 'read_file heuristic',
      stepOutlines,
      risks: [],
      alternatives: [],
    };
    // 12 outlines -> phase 2 runs in two batches of 10 and 2, so generateObject
    // is called 3 times total (1 outline + 2 expansion batches).
    let call = 0;
    const generateObject = vi.fn().mockImplementation(async () => {
      call += 1;
      if (call === 1) {
        return outline;
      }
      const batchSize = call === 2 ? 10 : 2;
      return {
        steps: Array.from({ length: batchSize }, (_, i) =>
          makeDetailStep({
            description: `读取文件 ${i}`,
            action: 'read_file',
            phase: '阶段1-分析',
          }),
        ),
      };
    });
    const { deps } = buildDeps(generateObject);

    await generatePlanInTwoPhases(baseOptions, deps);

    // Indices 0-9 (i < 10) get 阶段1-分析 via the read_file && i<10 special case.
    for (let i = 0; i < 10; i++) {
      expect(outline.stepOutlines[i].phase).toBe('阶段1-分析');
    }
    // Indices 10 and 11 (i >= 10) don't match the i<10 special case, but
    // read_file matches no other branch either, so they fall through to the
    // final else fallback, which also assigns 阶段1-分析. The i<10 sub-condition
    // is therefore not independently observable for read_file steps -- this
    // assertion documents that coincidence rather than a distinguishable branch.
    expect(outline.stepOutlines[10].phase).toBe('阶段1-分析');
    expect(outline.stepOutlines[11].phase).toBe('阶段1-分析');
  });

  it('restores a missing phase on an expanded step from its corresponding batch outline item', async () => {
    const outline = {
      summary: 'Restore phase summary',
      stepOutlines: [{ description: 'Create file A', action: 'create_file', phase: '阶段2-创建' }],
      risks: [],
      alternatives: [],
    };
    // Detail step comes back with an empty phase string, simulating the LLM
    // dropping the phase field during expansion.
    const detail = {
      steps: [
        makeDetailStep({
          description: 'Create file A',
          action: 'create_file',
          tool: 'create_file',
          phase: '',
          needsCodeGeneration: true,
        }),
      ],
    };

    const generateObject = vi.fn().mockResolvedValueOnce(outline).mockResolvedValueOnce(detail);
    const { deps, debugWarn } = buildDeps(generateObject);

    const result = await generatePlanInTwoPhases(baseOptions, deps);

    expect(debugWarn).toHaveBeenCalledWith(expect.stringContaining('Restoring missing phase'));
    expect(result.steps[0].phase).toBe('阶段2-创建');
  });

  it('processes step outlines in batches of 10, issuing one generateObject call per batch in phase 2', async () => {
    // 12 step outlines -> 2 batches (10 + 2) -> phase1 call + 2 phase2 calls = 3 total.
    const stepOutlines = Array.from({ length: 12 }, (_, i) => ({
      description: `Step ${i}`,
      action: 'list_directory',
      phase: '阶段1-分析',
    }));
    const outline = {
      summary: 'Batch summary',
      stepOutlines,
      risks: [],
      alternatives: [],
    };

    // First call returns the outline; subsequent calls return a detail batch
    // sized to match the input batch.
    let call = 0;
    const generateObject = vi.fn().mockImplementation(async () => {
      call += 1;
      if (call === 1) {
        return outline;
      }
      const batchSize = call === 2 ? 10 : 2;
      return {
        steps: Array.from({ length: batchSize }, (_, i) =>
          makeDetailStep({
            description: `Step ${i}`,
            action: 'list_directory',
            phase: '阶段1-分析',
          }),
        ),
      };
    });

    const { deps } = buildDeps(generateObject);
    const result = await generatePlanInTwoPhases(baseOptions, deps);

    expect(generateObject).toHaveBeenCalledTimes(3);
    expect(result.steps).toHaveLength(12);
  });
});

describe('generatePlan', () => {
  it('delegates to the two-phase generator and surfaces its result on success', async () => {
    const outline = {
      summary: 'Delegated summary',
      stepOutlines: [
        { description: 'Inspect repo', action: 'list_directory', phase: '阶段1-分析' },
      ],
      risks: ['r1'],
      alternatives: ['a1'],
    };
    const detail = {
      steps: [
        makeDetailStep({
          description: 'Inspect repo',
          action: 'list_directory',
          tool: 'list_directory',
          phase: '阶段1-分析',
        }),
      ],
    };

    const generateObject = vi.fn().mockResolvedValueOnce(outline).mockResolvedValueOnce(detail);
    const { deps } = buildDeps(generateObject);

    const result = await generatePlan(baseOptions, deps);

    expect(generateObject).toHaveBeenCalledTimes(2);
    expect(result.summary).toBe('Delegated summary');
    expect(result.steps).toHaveLength(1);
    expect(result.risks).toEqual(['r1']);
    expect(result.alternatives).toEqual(['a1']);
  });

  it('falls back to single-phase generation when the two-phase generator throws', async () => {
    // Force phase 1 (outline) to fail so generatePlanInTwoPhases rejects,
    // triggering the catch -> generatePlanSinglePhase fallback path.
    const fallbackPlan = {
      summary: 'Fallback summary',
      steps: [
        makeDetailStep({
          description: 'Fallback step',
          action: 'create_file',
          tool: 'create_file',
          phase: 'phase-1',
        }),
      ],
      risks: ['fallback risk'],
      alternatives: ['fallback alt'],
    };

    let call = 0;
    const generateObject = vi.fn().mockImplementation(async () => {
      call += 1;
      if (call === 1) {
        throw new Error('outline generation failed');
      }
      // Single-phase path uses GeneratedPlanSchema and returns the full plan directly.
      return fallbackPlan;
    });
    const { deps, debugWarn } = buildDeps(generateObject);

    const result = await generatePlan(baseOptions, deps);

    expect(debugWarn).toHaveBeenCalledWith(
      expect.stringContaining('Two-phase generation failed'),
      expect.any(Error),
    );
    expect(result.summary).toBe('Fallback summary');
    expect(result.steps).toHaveLength(1);
  });
});
