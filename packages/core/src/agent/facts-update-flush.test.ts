import { describe, expect, it, vi } from 'vitest';
import { ContextManager } from '../context.js';
import type { ProjectFactsMergeResult, ProjectFactsUpdate } from '../types.js';
import { FactsUpdateFlusher } from './facts-update-flush.js';

function makeTask(id = 'task-1') {
  return {
    id,
    type: 'feature' as const,
    description: 'Test task',
    context: { workingDirectory: '/tmp/project' },
  };
}

function makeMergeResult(
  update: ProjectFactsUpdate,
  previousRevision: number,
): ProjectFactsMergeResult {
  return {
    applied: true,
    source: update.source,
    previousRevision,
    nextRevision: previousRevision + 1,
    staleBaseRevision: update.baseRevision !== previousRevision,
  };
}

describe('FactsUpdateFlusher', () => {
  it('merges queued facts updates and logs revisions in order', async () => {
    const contextManager = new ContextManager();
    contextManager.createContext(makeTask());
    const debugLog = vi.fn();
    const flusher = new FactsUpdateFlusher({ contextManager, debugLog });

    await flusher.enqueue('task-1', {
      baseRevision: 0,
      source: 'first-review',
      changes: { addExistingFiles: ['src/first.ts'] },
    });
    await flusher.enqueue('task-1', {
      baseRevision: 1,
      source: 'second-review',
      changes: { addExistingFiles: ['src/second.ts'] },
    });

    const facts = contextManager.getContext('task-1')!.facts;
    expect(Array.from(facts.filesystem.existingFiles)).toEqual(['src/first.ts', 'src/second.ts']);
    expect(facts.revision).toBe(2);
    expect(debugLog).toHaveBeenNthCalledWith(
      1,
      '[Agent] Merged facts update from first-review: r0 -> r1',
    );
    expect(debugLog).toHaveBeenNthCalledWith(
      2,
      '[Agent] Merged facts update from second-review: r1 -> r2',
    );
  });

  it('drains facts updates enqueued while a flush is already in progress', async () => {
    const debugLog = vi.fn();
    const mergedSources: string[] = [];
    let revision = 0;
    let flusher: FactsUpdateFlusher;

    const nestedUpdate: ProjectFactsUpdate = {
      baseRevision: 1,
      source: 'nested-review',
      changes: { addExistingFiles: ['src/nested.ts'] },
    };

    const contextManager = {
      mergeFactsUpdate: vi.fn((taskId: string, update: ProjectFactsUpdate) => {
        expect(taskId).toBe('task-1');
        const previousRevision = revision;
        mergedSources.push(update.source);
        revision += 1;

        if (update.source === 'outer-review') {
          void flusher.enqueue(taskId, nestedUpdate);
        }

        return makeMergeResult(update, previousRevision);
      }),
    } as unknown as ContextManager;

    flusher = new FactsUpdateFlusher({ contextManager, debugLog });

    await flusher.enqueue('task-1', {
      baseRevision: 0,
      source: 'outer-review',
      changes: { addExistingFiles: ['src/outer.ts'] },
    });

    expect(mergedSources).toEqual(['outer-review', 'nested-review']);
    expect(contextManager.mergeFactsUpdate).toHaveBeenCalledTimes(2);
    expect(debugLog).toHaveBeenNthCalledWith(
      1,
      '[Agent] Merged facts update from outer-review: r0 -> r1',
    );
    expect(debugLog).toHaveBeenNthCalledWith(
      2,
      '[Agent] Merged facts update from nested-review: r1 -> r2',
    );
  });

  it('clears pending facts updates when reset is called', async () => {
    const debugLog = vi.fn();
    let flusher: FactsUpdateFlusher;
    const mergedSources: string[] = [];

    const contextManager = {
      mergeFactsUpdate: vi.fn((taskId: string, update: ProjectFactsUpdate) => {
        mergedSources.push(update.source);
        if (update.source === 'blocking-review') {
          void flusher.enqueue(taskId, {
            baseRevision: 1,
            source: 'queued-review',
            changes: { addExistingFiles: ['src/queued.ts'] },
          });
          flusher.reset();
        }
        return makeMergeResult(update, mergedSources.length - 1);
      }),
    } as unknown as ContextManager;

    flusher = new FactsUpdateFlusher({ contextManager, debugLog });

    await flusher.enqueue('task-1', {
      baseRevision: 0,
      source: 'blocking-review',
      changes: { addExistingFiles: ['src/blocking.ts'] },
    });

    expect(mergedSources).toEqual(['blocking-review']);
    expect(contextManager.mergeFactsUpdate).toHaveBeenCalledTimes(1);
  });
});
