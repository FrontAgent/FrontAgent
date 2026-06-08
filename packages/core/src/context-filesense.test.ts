import type { AgentTask } from '@frontagent/shared';
import { describe, expect, it } from 'vitest';
import { ContextManager } from './context.js';

function task(): AgentTask {
  return {
    id: 'task-filesense',
    description: '梳理目录结构',
    type: 'query',
    status: 'pending',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    context: {},
  } as AgentTask;
}

describe('ContextManager Filesense navigation', () => {
  it('normalizes navigate summary, candidates, warnings and scanned metadata', () => {
    const manager = new ContextManager();
    const t = task();
    manager.createContext(t);

    manager.updateFilesenseNavigation(t.id, {
      intent: 'understand_structure',
      paths: ['src'],
      data: {
        scanned: { paths: ['src'], entries: 42, elapsedMs: 5, truncated: false },
        summary: {
          projectType: 'react',
          packageManager: 'pnpm',
          mainEntrypoints: ['src/main.tsx'],
          importantDirs: [{ path: 'src/components', purpose: 'UI components', confidence: 0.8 }],
          conventions: ['hooks live in src/hooks'],
          risks: ['large directory'],
        },
        candidates: [{ path: 'src/App.tsx', type: 'file', reason: 'root component', score: 0.9 }],
        warnings: ['budget near limit'],
      },
    });

    const context = manager.getContext(t.id)!;
    expect(context.collectedContext.filesenseNavigation?.scanned.entries).toBe(42);
    expect(context.collectedContext.filesenseNavigation?.candidates[0].path).toBe('src/App.tsx');
    expect(context.collectedContext.filesenseContext).toContain('src/App.tsx');
    expect(context.collectedContext.filesenseContext).toContain('large directory');
  });
});
