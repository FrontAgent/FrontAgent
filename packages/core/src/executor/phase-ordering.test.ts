import type { ExecutionStep } from '@frontagent/shared';
import { describe, expect, it, vi } from 'vitest';
import { buildOrderedPhaseGroups, detectLanguage, getPhasePriority } from './phase-ordering.js';

function makeStep(overrides: Partial<ExecutionStep> = {}): ExecutionStep {
  return {
    stepId: 'step-1',
    action: 'create_file',
    description: 'Create a file',
    phase: '实现',
    dependencies: [],
    validation: { type: 'exists', target: 'src/index.ts' },
    ...overrides,
  };
}

describe('getPhasePriority', () => {
  it('assigns lowest priority to analysis phases', () => {
    expect(getPhasePriority('分析需求')).toBe(10);
    expect(getPhasePriority('analyze requirements')).toBe(10);
  });

  it('assigns priority 20 to creation/implementation phases', () => {
    expect(getPhasePriority('创建组件')).toBe(20);
    expect(getPhasePriority('implement feature')).toBe(20);
  });

  it('assigns priority 30 to install phases', () => {
    expect(getPhasePriority('安装依赖')).toBe(30);
    expect(getPhasePriority('install packages')).toBe(30);
  });

  it('assigns priority 40 to validation phases', () => {
    expect(getPhasePriority('验证结果')).toBe(40);
    expect(getPhasePriority('validate output')).toBe(40);
    expect(getPhasePriority('验收测试')).toBe(40);
    expect(getPhasePriority('acceptance test')).toBe(40);
  });

  it('assigns priority 50 to start/serve phases', () => {
    expect(getPhasePriority('启动服务')).toBe(50);
    expect(getPhasePriority('start server')).toBe(50);
  });

  it('assigns priority 60 to browser phases', () => {
    expect(getPhasePriority('浏览器测试')).toBe(60);
    expect(getPhasePriority('browser test')).toBe(60);
  });

  it('assigns priority 70 to repository phases', () => {
    expect(getPhasePriority('仓库操作')).toBe(70);
    expect(getPhasePriority('repository setup')).toBe(70);
  });

  it('assigns priority 90 to ungrouped phases', () => {
    expect(getPhasePriority('未分组')).toBe(90);
    expect(getPhasePriority('ungrouped')).toBe(90);
  });

  it('assigns default priority 80 to unknown phases', () => {
    expect(getPhasePriority('something else')).toBe(80);
    expect(getPhasePriority('')).toBe(80);
  });

  it('is case-insensitive', () => {
    expect(getPhasePriority('ANALYZE')).toBe(10);
    expect(getPhasePriority('Install')).toBe(30);
  });
});

describe('detectLanguage', () => {
  it('detects TypeScript files', () => {
    expect(detectLanguage('src/index.ts')).toBe('typescript');
    expect(detectLanguage('App.tsx')).toBe('typescript');
  });

  it('detects JavaScript files', () => {
    expect(detectLanguage('index.js')).toBe('javascript');
    expect(detectLanguage('App.jsx')).toBe('javascript');
    expect(detectLanguage('config.mjs')).toBe('javascript');
    expect(detectLanguage('config.cjs')).toBe('javascript');
  });

  it('detects JSON files', () => {
    expect(detectLanguage('package.json')).toBe('json');
  });

  it('detects YAML files', () => {
    expect(detectLanguage('config.yaml')).toBe('yaml');
    expect(detectLanguage('config.yml')).toBe('yaml');
  });

  it('returns null for unknown extensions', () => {
    expect(detectLanguage('readme.md')).toBeNull();
    expect(detectLanguage('style.css')).toBeNull();
    expect(detectLanguage('image.png')).toBeNull();
  });
});

describe('buildOrderedPhaseGroups', () => {
  it('groups steps by phase', () => {
    const steps = [
      makeStep({ stepId: 's1', phase: '分析' }),
      makeStep({ stepId: 's2', phase: '实现' }),
      makeStep({ stepId: 's3', phase: '分析' }),
    ];

    const groups = buildOrderedPhaseGroups(steps);
    expect(groups).toHaveLength(2);
    const analysisGroup = groups.find((g) => g.phase === '分析');
    expect(analysisGroup?.steps).toHaveLength(2);
  });

  it('orders groups by priority', () => {
    const steps = [
      makeStep({ stepId: 's1', phase: '验证' }),
      makeStep({ stepId: 's2', phase: '分析' }),
      makeStep({ stepId: 's3', phase: '实现' }),
    ];

    const groups = buildOrderedPhaseGroups(steps);
    expect(groups[0].phase).toBe('分析');
    expect(groups[1].phase).toBe('实现');
    expect(groups[2].phase).toBe('验证');
  });

  it('uses default phase for steps without phase', () => {
    const steps = [makeStep({ stepId: 's1', phase: undefined })];

    const groups = buildOrderedPhaseGroups(steps);
    expect(groups[0].phase).toBe('未分组');
  });

  it('respects step dependencies across phases', () => {
    const steps = [
      makeStep({ stepId: 's1', phase: 'B-implement', dependencies: ['s2'] }),
      makeStep({ stepId: 's2', phase: 'A-analyze', dependencies: [] }),
    ];

    const groups = buildOrderedPhaseGroups(steps);
    const phases = groups.map((g) => g.phase);
    expect(phases.indexOf('A-analyze')).toBeLessThan(phases.indexOf('B-implement'));
  });

  it('handles circular dependencies gracefully', () => {
    const debugWarn = vi.fn();
    const steps = [
      makeStep({ stepId: 's1', phase: 'A', dependencies: ['s2'] }),
      makeStep({ stepId: 's2', phase: 'B', dependencies: ['s1'] }),
    ];

    const groups = buildOrderedPhaseGroups(steps, debugWarn);
    expect(groups).toHaveLength(2);
    expect(debugWarn).toHaveBeenCalledWith(expect.stringContaining('cycle'));
  });

  it('returns empty array for empty steps', () => {
    expect(buildOrderedPhaseGroups([])).toEqual([]);
  });

  it('preserves firstSeenIndex for stable ordering', () => {
    const steps = [
      makeStep({ stepId: 's1', phase: 'same-priority-a' }),
      makeStep({ stepId: 's2', phase: 'same-priority-b' }),
    ];

    const groups = buildOrderedPhaseGroups(steps);
    expect(groups[0].firstSeenIndex).toBe(0);
    expect(groups[1].firstSeenIndex).toBe(1);
  });
});
