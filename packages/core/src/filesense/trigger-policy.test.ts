import { describe, expect, it } from 'vitest';
import type { AgentTask, ExecutionStep } from '@frontagent/shared';
import { decideFilesense } from './trigger-policy.js';

function task(description: string, type: AgentTask['type'] = 'query'): AgentTask {
  return {
    id: 'task-1',
    description,
    type,
    status: 'pending',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    context: {},
  } as AgentTask;
}

function step(action: ExecutionStep['action'], params: Record<string, unknown> = {}): ExecutionStep {
  return {
    stepId: `step-${action}`,
    description: action,
    action,
    tool: action,
    params,
    dependencies: [],
    validation: [],
    status: 'pending',
  };
}

describe('decideFilesense', () => {
  it('skips known single-file tasks', () => {
    const decision = decideFilesense(task('modify this file', 'modify'), [step('read_file', { path: 'src/App.tsx' })]);
    expect(decision.enabled).toBe(false);
    expect(decision.reason).toContain('single-file');
  });

  it('injects lightweight navigation for repository structure queries', () => {
    const decision = decideFilesense(task('梳理 src 目录结构'), [step('list_directory', { path: '.' })]);
    expect(decision.enabled).toBe(true);
    expect(decision.intent).toBe('understand_structure');
    expect(decision.paths).toContain('src');
    expect(decision.maxEntries).toBeLessThanOrEqual(250);
  });

  it('uses a narrow freshness budget for stale path checks', () => {
    const decision = decideFilesense(task('找不到 components 里的最新入口在哪'), [step('search_code', { path: '.' })]);
    expect(decision.enabled).toBe(true);
    expect(decision.intent).toBe('validate_freshness');
    expect(decision.paths).toContain('components');
    expect(decision.depth).toBe(1);
    expect(decision.timeoutMs).toBeLessThanOrEqual(1500);
  });
});
