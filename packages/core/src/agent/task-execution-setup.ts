import type { SDDPromptGenerator } from '@frontagent/sdd';
import type { AgentTask, SDDConfig } from '@frontagent/shared';
import { loadProjectInstructions } from '../context/project-instructions.js';
import type { ContextManager } from '../context.js';
import type { Executor } from '../executor.js';
import type { MemoryStore } from '../memory/index.js';
import type { AgentConfig, AgentEvent } from '../types.js';
import type { WorkflowIntegration } from '../workflow-integration.js';
import {
  type MemoryLifecycleDeps,
  preloadMemory as preloadMemoryDefault,
} from './memory-lifecycle.js';
import {
  type ProjectPlanningPreparation,
  prepareProjectPlanningContext as prepareProjectPlanningContextDefault,
} from './project-prescan-preparation.js';
import type { RagRetrievalDeps } from './rag-retrieval.js';

type AgentContext = NonNullable<ReturnType<ContextManager['getContext']>>;
type PlanningDeps = {
  executor: Pick<Executor, 'callTool'>;
  ragDeps: RagRetrievalDeps;
  emitStatus: (label: string, operation?: string, detail?: string) => void;
  debugLog: (...args: unknown[]) => void;
  debugWarn: (...args: unknown[]) => void;
};

export interface TaskExecutionSetupDeps {
  config: AgentConfig;
  sddConfig?: SDDConfig;
  contextManager: Pick<ContextManager, 'createContext' | 'addMessage'>;
  memoryStore: Pick<MemoryStore, 'resetSession'>;
  memoryDeps: MemoryLifecycleDeps;
  promptGenerator?: Pick<SDDPromptGenerator, 'generate'>;
  workflowIntegration?: Pick<WorkflowIntegration, 'getConstitutionPrompt'>;
  planningDeps: PlanningDeps;
  preloadMemory?: typeof preloadMemoryDefault;
  prepareProjectPlanningContext?: typeof prepareProjectPlanningContextDefault;
  emit: (event: AgentEvent) => void;
  emitStatus: (label: string, operation?: string, detail?: string) => void;
}

export interface PrepareTaskExecutionSetupInput {
  task: AgentTask;
  originalTaskDescription: string;
  skillContext?: string;
  matchedSkillNames: string[];
  deps: TaskExecutionSetupDeps;
}

export interface TaskExecutionSetup {
  task: AgentTask;
  context: AgentContext;
  planningPreparation: ProjectPlanningPreparation;
  skillContext?: string;
  matchedSkillNames: string[];
}

export async function prepareTaskExecutionSetup({
  task,
  originalTaskDescription,
  skillContext,
  matchedSkillNames,
  deps,
}: PrepareTaskExecutionSetupInput): Promise<TaskExecutionSetup> {
  const context = deps.contextManager.createContext(task, deps.sddConfig) as AgentContext;
  context.collectedContext.skillContext = skillContext;
  context.collectedContext.matchedSkillNames = matchedSkillNames;
  context.collectedContext.metadata.originalTaskDescription = originalTaskDescription;

  deps.emitStatus('加载跨会话记忆', '加载跨会话记忆');
  deps.memoryStore.resetSession();
  const preload = deps.preloadMemory ?? preloadMemoryDefault;
  preload(deps.memoryDeps, task.id, context);

  context.collectedContext.projectInstructions = loadProjectInstructions({
    projectRoot: deps.config.projectRoot,
    cwd: process.cwd(),
  });

  if (deps.promptGenerator) {
    const constitutionPrompt = deps.workflowIntegration?.getConstitutionPrompt();
    if (constitutionPrompt) {
      deps.contextManager.addMessage(task.id, { role: 'system', content: constitutionPrompt });
    }
    deps.contextManager.addMessage(task.id, {
      role: 'system',
      content: deps.promptGenerator.generate(),
    });
  }

  const prepareProjectPlanningContext =
    deps.prepareProjectPlanningContext ?? prepareProjectPlanningContextDefault;
  const planningPreparation = await prepareProjectPlanningContext({
    deps: deps.planningDeps,
    taskId: task.id,
    taskDescription: task.description,
    projectRoot: deps.config.projectRoot,
    ragEnabled: deps.config.rag?.enabled !== false,
    preScanFailureLabel: '[Agent] Failed to pre-scan project structure:',
    logProjectStructure: true,
  });

  if (deps.config.rag?.enabled !== false) {
    deps.emit({
      type: 'rag_retrieved',
      ...planningPreparation.ragEvent,
    });
  }

  return {
    task,
    context,
    planningPreparation,
    skillContext,
    matchedSkillNames,
  };
}
