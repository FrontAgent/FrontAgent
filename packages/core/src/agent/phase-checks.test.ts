import type { ExecutionStep } from '@frontagent/shared';
import { describe, expect, it } from 'vitest';
import { collectGeneratedCodeFilesForPhase, shouldRunPhaseChecks } from './phase-checks.js';

describe('shouldRunPhaseChecks', () => {
  it('returns true for Chinese create phase', () => {
    expect(shouldRunPhaseChecks('创建组件')).toBe(true);
  });

  it('returns true for Chinese implement phase', () => {
    expect(shouldRunPhaseChecks('实现功能')).toBe(true);
  });

  it('returns true for ungrouped phase', () => {
    expect(shouldRunPhaseChecks('未分组')).toBe(true);
  });

  it('returns true for English create phase (case-insensitive)', () => {
    expect(shouldRunPhaseChecks('Create Components')).toBe(true);
  });

  it('returns true for English implement phase (case-insensitive)', () => {
    expect(shouldRunPhaseChecks('Implement Feature')).toBe(true);
  });

  it('returns false for review phase', () => {
    expect(shouldRunPhaseChecks('review')).toBe(false);
  });

  it('returns false for planning phase', () => {
    expect(shouldRunPhaseChecks('planning')).toBe(false);
  });

  it('returns false for testing phase', () => {
    expect(shouldRunPhaseChecks('测试')).toBe(false);
  });
});

describe('collectGeneratedCodeFilesForPhase', () => {
  const baseDeps = {
    config: { subAgents: { codeQualityEvaluator: { maxFilesPerPhase: 20 } } },
  } as Parameters<typeof collectGeneratedCodeFilesForPhase>[0];

  function makeStep(overrides: Partial<ExecutionStep>): ExecutionStep {
    return {
      stepId: 'step-1',
      description: 'test',
      action: 'create_file',
      tool: 'write_file',
      params: { path: 'src/app.ts' },
      dependencies: [],
      validation: [],
      status: 'completed',
      phase: '实现',
      ...overrides,
    };
  }

  it('collects code files from completed create_file steps', () => {
    const steps = [makeStep({ params: { path: 'src/component.tsx' } })];
    const result = collectGeneratedCodeFilesForPhase(baseDeps, '实现', steps);
    expect(result).toEqual(['src/component.tsx']);
  });

  it('collects apply_patch steps', () => {
    const steps = [makeStep({ action: 'apply_patch', params: { path: 'src/fix.ts' } })];
    const result = collectGeneratedCodeFilesForPhase(baseDeps, '实现', steps);
    expect(result).toEqual(['src/fix.ts']);
  });

  it('skips non-code files', () => {
    const steps = [makeStep({ params: { path: 'README.md' } })];
    const result = collectGeneratedCodeFilesForPhase(baseDeps, '实现', steps);
    expect(result).toEqual([]);
  });

  it('skips steps from other phases', () => {
    const steps = [makeStep({ phase: '测试' })];
    const result = collectGeneratedCodeFilesForPhase(baseDeps, '实现', steps);
    expect(result).toEqual([]);
  });

  it('skips non-completed steps', () => {
    const steps = [makeStep({ status: 'pending' })];
    const result = collectGeneratedCodeFilesForPhase(baseDeps, '实现', steps);
    expect(result).toEqual([]);
  });

  it('skips non-file-creation actions', () => {
    const steps = [makeStep({ action: 'read_file' })];
    const result = collectGeneratedCodeFilesForPhase(baseDeps, '实现', steps);
    expect(result).toEqual([]);
  });

  it('deduplicates paths', () => {
    const steps = [
      makeStep({ stepId: 's1', params: { path: 'src/app.ts' } }),
      makeStep({ stepId: 's2', params: { path: 'src/app.ts' } }),
    ];
    const result = collectGeneratedCodeFilesForPhase(baseDeps, '实现', steps);
    expect(result).toEqual(['src/app.ts']);
  });

  it('respects maxFilesPerPhase limit', () => {
    const deps = {
      config: { subAgents: { codeQualityEvaluator: { maxFilesPerPhase: 2 } } },
    } as Parameters<typeof collectGeneratedCodeFilesForPhase>[0];
    const steps = [
      makeStep({ stepId: 's1', params: { path: 'src/a.ts' } }),
      makeStep({ stepId: 's2', params: { path: 'src/b.ts' } }),
      makeStep({ stepId: 's3', params: { path: 'src/c.ts' } }),
    ];
    const result = collectGeneratedCodeFilesForPhase(deps, '实现', steps);
    expect(result).toHaveLength(2);
  });

  it('treats steps without phase as ungrouped', () => {
    const steps = [makeStep({ phase: undefined })];
    const result = collectGeneratedCodeFilesForPhase(baseDeps, '未分组', steps);
    expect(result).toEqual(['src/app.ts']);
  });
});
