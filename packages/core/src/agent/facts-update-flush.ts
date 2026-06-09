import type { ContextManager } from '../context.js';
import type { ProjectFactsUpdate } from '../types.js';

export interface FactsUpdateFlusherDeps {
  contextManager: ContextManager;
  debugLog: (...args: unknown[]) => void;
}

export class FactsUpdateFlusher {
  private pendingFactsUpdates: ProjectFactsUpdate[] = [];
  private flushInProgress = false;

  constructor(private readonly deps: FactsUpdateFlusherDeps) {}

  reset(): void {
    this.pendingFactsUpdates = [];
    this.flushInProgress = false;
  }

  async enqueue(taskId: string, update: ProjectFactsUpdate): Promise<void> {
    this.pendingFactsUpdates.push(update);
    await this.flush(taskId);
  }

  private async flush(taskId: string): Promise<void> {
    if (this.flushInProgress) {
      return;
    }

    this.flushInProgress = true;
    while (true) {
      try {
        while (this.pendingFactsUpdates.length > 0) {
          const nextUpdate = this.pendingFactsUpdates.shift();
          if (!nextUpdate) {
            continue;
          }

          const mergeResult = this.deps.contextManager.mergeFactsUpdate(taskId, nextUpdate);
          const staleText = mergeResult.staleBaseRevision
            ? ' (stale base revision, rebased in main reducer)'
            : '';
          this.deps.debugLog(
            `[Agent] Merged facts update from ${mergeResult.source}: ` +
              `r${mergeResult.previousRevision} -> r${mergeResult.nextRevision}${staleText}`,
          );
        }
      } finally {
        this.flushInProgress = false;
      }

      if (this.pendingFactsUpdates.length === 0) {
        break;
      }

      this.flushInProgress = true;
    }
  }
}
