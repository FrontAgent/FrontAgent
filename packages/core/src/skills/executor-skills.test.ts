import type { AgentTask, ExecutionStep } from '@frontagent/shared';
import { describe, expect, it, vi } from 'vitest';
import type {
  ExecutorActionSkill,
  ExecutorSkillRuntime,
  ExecutorStepContextSnapshot,
} from './executor-skills.js';
import {
  createDefaultExecutorSkillRegistry,
  ExecutorSkillRegistry,
} from './executor-skills.js';

// `needsCodeGeneration` is read via a structural cast inside the create_file
// skill; it is not a declared ExecutionStep field, so widen the override type.
type StepOverrides = Partial<ExecutionStep> & { needsCodeGeneration?: boolean };

function makeStep(overrides: StepOverrides = {}): ExecutionStep {
  return {
    stepId: 'step-1',
    description: 'Test step',
    action: 'create_file',
    tool: 'create_file',
    params: {},
    dependencies: [],
    validation: [],
    status: 'pending',
    phase: 'build',
    ...overrides,
  };
}

function makeTask(overrides: Partial<AgentTask> = {}): AgentTask {
  return {
    id: 't1',
    type: 'create',
    description: 'test task',
    ...overrides,
  };
}

function makeContext(files: Array<[string, string]> = []): ExecutorStepContextSnapshot {
  return {
    task: makeTask(),
    collectedContext: { files: new Map(files) },
  };
}

function makeRuntime() {
  const generateCodeForFile = vi.fn().mockResolvedValue('GENERATED_CODE');
  const generateModifiedCode = vi.fn().mockResolvedValue('MODIFIED_CODE');
  const runtime = {
    llmService: { generateCodeForFile, generateModifiedCode },
    buildContextString: vi.fn().mockReturnValue('CONTEXT'),
    detectLanguage: vi.fn().mockReturnValue('typescript'),
  } as unknown as ExecutorSkillRuntime;
  return { runtime, generateCodeForFile, generateModifiedCode };
}

describe('run_command error policy (action.run-command.error-policy)', () => {
  function skipFor(command: string, errorMsg: string): boolean | undefined {
    const registry = createDefaultExecutorSkillRegistry(makeRuntime().runtime);
    const step = makeStep({ action: 'run_command', tool: 'run_command', params: { command } });
    return registry.shouldSkipToolError({ errorMsg, step, params: { command } });
  }

  it('treats multi-word build commands as critical via substring match (never skipped)', () => {
    expect(skipFor('pnpm build', 'File exists')).toBe(false);
  });

  it('treats npx tsc as critical via word-boundary tsc matching', () => {
    expect(skipFor('npx tsc', 'File exists')).toBe(false);
  });

  it('treats tsc --noEmit as critical', () => {
    expect(skipFor('tsc --noEmit', 'File exists')).toBe(false);
  });

  it('does NOT treat cat tsconfig.json as critical: a skippable error is skipped', () => {
    // RED under the old substring matcher: "tsc" inside "tsconfig" used to
    // classify this command as critical and return false.
    expect(skipFor('cat tsconfig.json', 'File exists')).toBe(true);
  });

  it('returns false for a non-critical command with a non-skippable error', () => {
    expect(skipFor('cat tsconfig.json', 'permission denied')).toBe(false);
  });

  it('skips already-exists errors for ordinary commands', () => {
    expect(skipFor('mkdir src/components', 'Directory already exists')).toBe(true);
  });
});

describe('ExecutorSkillRegistry resolution and override semantics', () => {
  it('resolves known actions to their default skills via snapshot().byAction', () => {
    const registry = createDefaultExecutorSkillRegistry(makeRuntime().runtime);
    const snapshot = registry.snapshot();
    expect(snapshot.byAction.create_file).toBe('action.create-file.codegen');
    expect(snapshot.byAction.apply_patch).toBe('action.apply-patch.codegen');
    expect(snapshot.byAction.run_command).toBe('action.run-command.error-policy');
    expect(snapshot.byAction.read_file).toBe('action.read-file');
  });

  it('a later-registered skill shadows the default for the same action across every method', async () => {
    const { runtime, generateCodeForFile } = makeRuntime();
    const registry = createDefaultExecutorSkillRegistry(runtime);
    const override: ExecutorActionSkill = {
      name: 'custom.create-file',
      action: 'create_file',
      requiredParams: ['path', 'content'],
      validateParams: () => ({ valid: false, reason: 'custom says no' }),
      prepareToolParams: async ({ params }) => ({ ...params, custom: true }),
      shouldSkipToolError: () => true,
    };
    registry.registerActionSkill(override);

    const step = makeStep({ action: 'create_file' });
    expect(registry.snapshot().byAction.create_file).toBe('custom.create-file');
    expect(registry.resolveRequiredParams('create_file')).toEqual(['path', 'content']);
    expect(registry.validateStepParams(step, { path: 'a.ts', content: 'x' })).toEqual({
      valid: false,
      reason: 'custom says no',
    });
    await expect(
      registry.prepareToolParams({ step, params: { path: 'a.ts' }, context: makeContext() }),
    ).resolves.toEqual({ path: 'a.ts', custom: true });
    expect(registry.shouldSkipToolError({ errorMsg: 'anything', step, params: {} })).toBe(true);
    // The default codegen skill is fully shadowed: no LLM call happened.
    expect(generateCodeForFile).not.toHaveBeenCalled();
  });

  it('snapshot lists both the default and the override, but byAction points at the later one', () => {
    const registry = createDefaultExecutorSkillRegistry(makeRuntime().runtime);
    registry.registerActionSkill({ name: 'custom.create-file', action: 'create_file' });
    const snapshot = registry.snapshot();
    expect(snapshot.actionSkills).toContain('action.create-file.codegen');
    expect(snapshot.actionSkills).toContain('custom.create-file');
    expect(snapshot.byAction.create_file).toBe('custom.create-file');
  });

  it('returns empty/undefined defaults for an unregistered action', async () => {
    const registry = new ExecutorSkillRegistry();
    const step = makeStep({ action: 'read_file' });
    const params = { path: 'a.ts' };
    expect(registry.resolveRequiredParams('read_file')).toEqual([]);
    expect(registry.validateStepParams(step, params)).toBeNull();
    // No skill -> the registry resolves to the SAME params object reference.
    await expect(
      registry.prepareToolParams({ step, params, context: makeContext() }),
    ).resolves.toBe(params);
    expect(registry.shouldSkipToolError({ errorMsg: 'boom', step, params })).toBeUndefined();
  });
});

describe('validateParams', () => {
  describe('create_file (action.create-file.codegen)', () => {
    function validate(params: Record<string, unknown>, needsCodeGeneration?: boolean) {
      const registry = createDefaultExecutorSkillRegistry(makeRuntime().runtime);
      const step = makeStep({ action: 'create_file', needsCodeGeneration });
      return registry.validateStepParams(step, params);
    }

    it('is invalid when content, codeDescription and needsCodeGeneration are all absent', () => {
      expect(validate({ path: 'src/a.ts' })).toEqual({
        valid: false,
        reason: 'create_file requires content, codeDescription, or needsCodeGeneration=true',
      });
    });

    it('is valid when content is present', () => {
      expect(validate({ path: 'src/a.ts', content: 'export {}' })).toEqual({ valid: true });
    });

    it('is valid when codeDescription is present', () => {
      expect(validate({ path: 'src/a.ts', codeDescription: 'a util module' })).toEqual({
        valid: true,
      });
    });

    it('is valid when needsCodeGeneration is true', () => {
      expect(validate({ path: 'src/a.ts' }, true)).toEqual({ valid: true });
    });
  });

  describe('search_code (action.search-code)', () => {
    function validate(params: Record<string, unknown>) {
      const registry = createDefaultExecutorSkillRegistry(makeRuntime().runtime);
      return registry.validateStepParams(makeStep({ action: 'search_code' }), params);
    }

    it('is invalid when neither query nor pattern is provided', () => {
      expect(validate({})).toEqual({
        valid: false,
        reason: 'search_code requires non-empty query or pattern parameter',
      });
    });

    it('is invalid when query and pattern are blank strings', () => {
      expect(validate({ query: '   ', pattern: '' })).toEqual({
        valid: false,
        reason: 'search_code requires non-empty query or pattern parameter',
      });
    });

    it('is valid with a query', () => {
      expect(validate({ query: 'createUser' })).toEqual({ valid: true });
    });

    it('is valid with a pattern', () => {
      expect(validate({ pattern: '*.tsx' })).toEqual({ valid: true });
    });
  });
});

describe('shouldSkipToolError policies', () => {
  function skipFor(action: ExecutionStep['action'], errorMsg: string): boolean | undefined {
    const registry = createDefaultExecutorSkillRegistry(makeRuntime().runtime);
    const step = makeStep({ action, tool: action, params: {} });
    return registry.shouldSkipToolError({ errorMsg, step, params: {} });
  }

  it('filesense actions are always non-fatal', () => {
    expect(skipFor('filesense_navigate', 'index server crashed')).toBe(true);
    expect(skipFor('filesense_sync_and_summarize', 'index server crashed')).toBe(true);
    expect(skipFor('filesense_query', 'index server crashed')).toBe(true);
  });

  it('read_file skips missing-file errors only', () => {
    expect(skipFor('read_file', 'File not found: src/a.ts')).toBe(true);
    expect(skipFor('read_file', 'path does not exist')).toBe(true);
    expect(skipFor('read_file', '文件不存在: src/a.ts')).toBe(true);
    expect(skipFor('read_file', 'permission denied')).toBeUndefined();
  });

  it('list_directory skips missing-directory errors only', () => {
    expect(skipFor('list_directory', 'Directory not found: src')).toBe(true);
    expect(skipFor('list_directory', '目录不存在: src')).toBe(true);
    expect(skipFor('list_directory', 'permission denied')).toBeUndefined();
  });

  it('get_ast skips its known non-fatal messages only', () => {
    expect(skipFor('get_ast', 'File not found: src/a.ts')).toBe(true);
    expect(skipFor('get_ast', 'path does not exist')).toBe(true);
    expect(skipFor('get_ast', 'Not a file: src')).toBe(true);
    expect(skipFor('get_ast', 'syntax error in file')).toBeUndefined();
  });
});

describe('create_file prepareToolParams (codegen path)', () => {
  it('returns params unchanged and does not call codegen when content is present', async () => {
    const { runtime, generateCodeForFile } = makeRuntime();
    const registry = createDefaultExecutorSkillRegistry(runtime);
    const params = { path: 'src/a.ts', content: 'export {}' };
    const result = await registry.prepareToolParams({
      step: makeStep({ action: 'create_file', params }),
      params,
      context: makeContext(),
    });
    expect(result).toBe(params);
    expect(generateCodeForFile).not.toHaveBeenCalled();
  });

  it('generates content from codeDescription when content is absent', async () => {
    const { runtime, generateCodeForFile } = makeRuntime();
    const registry = createDefaultExecutorSkillRegistry(runtime);
    const params = { path: 'src/a.ts', codeDescription: 'a tiny util' };
    const result = await registry.prepareToolParams({
      step: makeStep({ action: 'create_file', params }),
      params,
      context: makeContext(),
    });
    expect(generateCodeForFile).toHaveBeenCalledTimes(1);
    expect(generateCodeForFile).toHaveBeenCalledWith(
      expect.objectContaining({
        task: 'test task',
        filePath: 'src/a.ts',
        codeDescription: 'a tiny util',
        language: 'typescript',
      }),
    );
    expect(result).toEqual({ ...params, content: 'GENERATED_CODE' });
  });

  it('generates content when needsCodeGeneration is true, falling back to step.description', async () => {
    const { runtime, generateCodeForFile } = makeRuntime();
    const registry = createDefaultExecutorSkillRegistry(runtime);
    const params = { path: 'src/a.ts' };
    const step = makeStep({
      action: 'create_file',
      description: 'create the util file',
      params,
      needsCodeGeneration: true,
    });
    const result = await registry.prepareToolParams({ step, params, context: makeContext() });
    expect(generateCodeForFile).toHaveBeenCalledTimes(1);
    expect(generateCodeForFile).toHaveBeenCalledWith(
      expect.objectContaining({ codeDescription: 'create the util file' }),
    );
    expect(result).toEqual({ ...params, content: 'GENERATED_CODE' });
  });
});

describe('apply_patch prepareToolParams (codegen path)', () => {
  it('returns params unchanged when patches already exist', async () => {
    const { runtime, generateModifiedCode } = makeRuntime();
    const registry = createDefaultExecutorSkillRegistry(runtime);
    const params = {
      path: 'src/a.ts',
      patches: [{ operation: 'replace', startLine: 1, endLine: 1, content: 'x' }],
    };
    const result = await registry.prepareToolParams({
      step: makeStep({ action: 'apply_patch', params }),
      params,
      context: makeContext([['src/a.ts', 'line1']]),
    });
    expect(result).toBe(params);
    expect(generateModifiedCode).not.toHaveBeenCalled();
  });

  it('generates a full-file replace patch when the file is in collected context', async () => {
    const { runtime, generateModifiedCode } = makeRuntime();
    const registry = createDefaultExecutorSkillRegistry(runtime);
    const original = 'line1\nline2\nline3';
    const params = { path: 'src/a.ts', changeDescription: 'rename the export' };
    const result = await registry.prepareToolParams({
      step: makeStep({ action: 'apply_patch', params }),
      params,
      context: makeContext([['src/a.ts', original]]),
    });
    expect(generateModifiedCode).toHaveBeenCalledTimes(1);
    expect(generateModifiedCode).toHaveBeenCalledWith(
      expect.objectContaining({
        originalCode: original,
        changeDescription: 'rename the export',
        filePath: 'src/a.ts',
        language: 'typescript',
      }),
    );
    expect(result).toEqual({
      ...params,
      patches: [{ operation: 'replace', startLine: 1, endLine: 3, content: 'MODIFIED_CODE' }],
    });
  });

  it('rejects when the file is not in collected context, and that exact error is skippable', async () => {
    const { runtime, generateModifiedCode } = makeRuntime();
    const registry = createDefaultExecutorSkillRegistry(runtime);
    const params = { path: 'src/missing.ts' };
    const step = makeStep({ action: 'apply_patch', params });

    let thrown: Error | undefined;
    try {
      await registry.prepareToolParams({ step, params, context: makeContext() });
    } catch (error) {
      thrown = error as Error;
    }

    expect(thrown).toBeDefined();
    expect(thrown?.message).toContain('file not found in context');
    expect(generateModifiedCode).not.toHaveBeenCalled();

    // Throw + skip contract: the message thrown by prepareToolParams must be
    // recognized as skippable by the same skill's shouldSkipToolError, so the
    // executor degrades gracefully instead of failing the step hard.
    expect(
      registry.shouldSkipToolError({ errorMsg: thrown?.message ?? '', step, params }),
    ).toBe(true);
  });

  it('shouldSkipToolError recognizes both apply_patch sentinel messages and ignores others', () => {
    const registry = createDefaultExecutorSkillRegistry(makeRuntime().runtime);
    const step = makeStep({ action: 'apply_patch', params: {} });
    expect(
      registry.shouldSkipToolError({
        errorMsg: 'Cannot apply patch: bad line range',
        step,
        params: {},
      }),
    ).toBe(true);
    expect(
      registry.shouldSkipToolError({ errorMsg: 'disk quota exceeded', step, params: {} }),
    ).toBeUndefined();
  });
});
