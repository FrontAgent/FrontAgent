import type { ContextManager } from '../context.js';
import type { MemoryStore } from '../memory/index.js';
import type { PersistenceInput } from '../memory/types.js';
import type { AgentConfig } from '../types.js';

export interface MemoryLifecycleDeps {
  config: AgentConfig;
  contextManager: ContextManager;
  memoryStore: MemoryStore;
  debugLog: (...args: unknown[]) => void;
  debugWarn: (...args: unknown[]) => void;
}

export function persistMemory(
  deps: MemoryLifecycleDeps,
  taskId: string,
  taskDescription: string,
): void {
  if (deps.config.memory?.enabled === false) return;

  try {
    const context = deps.contextManager.getContext(taskId);
    if (!context) return;

    const factsSnapshot = deps.contextManager.exportFactsSnapshot(taskId);
    if (!factsSnapshot) return;

    const createdFiles: string[] = [];
    for (const step of context.executedSteps) {
      if (
        step.status === 'completed' &&
        step.action === 'create_file' &&
        typeof step.params.path === 'string'
      ) {
        createdFiles.push(step.params.path);
      }
    }

    const errorResolutions: PersistenceInput['errorResolutions'] = [];
    const failedStepDescriptions = new Map<string, string>();
    for (const step of context.executedSteps) {
      if (step.status === 'failed' && step.result?.error) {
        failedStepDescriptions.set(step.action, step.result.error);
      }
    }
    for (const step of context.executedSteps) {
      if (step.status === 'completed' && step.phase && failedStepDescriptions.has(step.action)) {
        const originalError = failedStepDescriptions.get(step.action)!;
        errorResolutions.push({
          errorType: step.action,
          errorMessage: originalError,
          resolution: `Fixed via recovery step: ${step.description}`,
        });
        failedStepDescriptions.delete(step.action);
      }
    }

    const persistInput: PersistenceInput = {
      factsSnapshot,
      createdFiles,
      errorResolutions,
      dependencyChanges: {
        installed: Array.from(context.facts.dependencies.installedPackages),
        missing: Array.from(context.facts.dependencies.missingPackages),
      },
      taskDescription,
    };

    deps.memoryStore.persist(persistInput);

    deps.debugLog(
      `[Agent] 🧠 Persisted memory: ${createdFiles.length} files, ` +
        `${errorResolutions.length} error resolutions, ` +
        `${persistInput.dependencyChanges.installed.length} installed deps`,
    );
  } catch (error) {
    deps.debugWarn('[Agent] Memory persistence failed (non-blocking):', error);
  }
}

export function preloadMemory(
  deps: MemoryLifecycleDeps,
  taskId: string,
  context: NonNullable<ReturnType<ContextManager['getContext']>>,
): void {
  if (deps.config.memory?.enabled === false) return;
  if (!deps.memoryStore.hasMemory()) return;

  try {
    const factsSnapshot = deps.memoryStore.loadFactsSnapshot();
    if (factsSnapshot) {
      deps.contextManager.replaceFactsFromSnapshot(taskId, factsSnapshot);
      deps.debugLog(
        `[Agent] 🧠 Seeded facts from snapshot (r${factsSnapshot.revision}): ` +
          `${factsSnapshot.filesystem.existingFiles.length} files, ` +
          `${factsSnapshot.dependencies.installedPackages.length} packages`,
      );
    }

    const memoryContent = deps.memoryStore.preload();
    if (memoryContent) {
      context.collectedContext.memoryContext = memoryContent;
      deps.debugLog(`[Agent] 🧠 Preloaded memory content (${memoryContent.length} chars)`);
    }
  } catch (error) {
    deps.debugWarn('[Agent] Memory preload failed (non-blocking):', error);
  }
}
