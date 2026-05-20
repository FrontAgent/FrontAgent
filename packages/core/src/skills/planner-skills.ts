import type { AgentTask, ExecutionStep } from '@frontagent/shared';
import { decideFilesense } from '../filesense/trigger-policy.js';
import type {
  PhaseInjectionSkill,
  PlannerContextSnapshot,
  PlannerSkillsLayerSnapshot,
  PlannerStepFactory,
  TaskPlanningSkill,
} from './types.js';

export class PlannerSkillRegistry {
  private readonly taskSkills: TaskPlanningSkill[] = [];
  private readonly phaseSkills: PhaseInjectionSkill[] = [];

  constructor(params?: {
    taskSkills?: TaskPlanningSkill[];
    phaseSkills?: PhaseInjectionSkill[];
  }) {
    if (params?.taskSkills) {
      this.taskSkills.push(...params.taskSkills);
    }
    if (params?.phaseSkills) {
      this.phaseSkills.push(...params.phaseSkills);
    }
  }

  registerTaskSkill(skill: TaskPlanningSkill): void {
    this.taskSkills.push(skill);
  }

  registerPhaseSkill(skill: PhaseInjectionSkill): void {
    this.phaseSkills.push(skill);
  }

  generateTaskSteps(
    task: AgentTask,
    context: PlannerContextSnapshot,
    stepFactory: PlannerStepFactory,
  ): ExecutionStep[] {
    // Reverse iterate so newly registered skills can override built-ins.
    for (let i = this.taskSkills.length - 1; i >= 0; i--) {
      const skill = this.taskSkills[i];
      if (!skill.supports(task)) {
        continue;
      }
      return skill.plan({ task, context, stepFactory });
    }

    return [];
  }

  injectPhaseSteps(
    task: AgentTask,
    steps: ExecutionStep[],
    stepFactory: PlannerStepFactory,
    filesense?: import('../types.js').FilesenseConfig,
  ): ExecutionStep[] {
    let nextSteps = [...steps];

    for (const skill of this.phaseSkills) {
      if (!skill.shouldInject({ task, steps: nextSteps, filesense })) {
        continue;
      }

      nextSteps = skill.apply({
        task,
        steps: nextSteps,
        stepFactory,
        filesense,
      });
    }

    return nextSteps;
  }

  snapshot(): PlannerSkillsLayerSnapshot {
    return {
      taskSkills: this.taskSkills.map((skill) => skill.name),
      phaseSkills: this.phaseSkills.map((skill) => skill.name),
    };
  }
}

export interface DefaultPlannerSkillCallbacks {
  generateCreateSteps(task: AgentTask): ExecutionStep[];
  generateModifySteps(task: AgentTask, context: PlannerContextSnapshot): ExecutionStep[];
  generateQuerySteps(task: AgentTask): ExecutionStep[];
  generateDebugSteps(task: AgentTask, context: PlannerContextSnapshot): ExecutionStep[];
  generateRefactorSteps(task: AgentTask, context: PlannerContextSnapshot): ExecutionStep[];
  generateTestSteps(task: AgentTask): ExecutionStep[];
  injectRepositoryManagementPhase(task: AgentTask, steps: ExecutionStep[]): ExecutionStep[];
}

export function createDefaultPlannerSkillRegistry(
  callbacks: DefaultPlannerSkillCallbacks,
): PlannerSkillRegistry {
  const taskSkills: TaskPlanningSkill[] = [
    {
      name: 'task.create',
      supports: (task) => task.type === 'create',
      plan: ({ task }) => callbacks.generateCreateSteps(task),
    },
    {
      name: 'task.modify',
      supports: (task) => task.type === 'modify',
      plan: ({ task, context }) => callbacks.generateModifySteps(task, context),
    },
    {
      name: 'task.query',
      supports: (task) => task.type === 'query',
      plan: ({ task }) => callbacks.generateQuerySteps(task),
    },
    {
      name: 'task.debug',
      supports: (task) => task.type === 'debug',
      plan: ({ task, context }) => callbacks.generateDebugSteps(task, context),
    },
    {
      name: 'task.refactor',
      supports: (task) => task.type === 'refactor',
      plan: ({ task, context }) => callbacks.generateRefactorSteps(task, context),
    },
    {
      name: 'task.test',
      supports: (task) => task.type === 'test',
      plan: ({ task }) => callbacks.generateTestSteps(task),
    },
  ];

  const phaseSkills: PhaseInjectionSkill[] = [
    {
      name: 'phase.filesense-navigate',
      shouldInject: ({ task, steps, filesense }) => filesense?.enabled !== false && decideFilesense(task, steps).enabled,
      apply: ({ task, steps, stepFactory, filesense }) => {
        const decision = decideFilesense(task, steps);
        if (!decision.enabled) return steps;

        const navigateStep = stepFactory.createStep({
          description: `按需构建目录导航上下文：${decision.reason}`,
          action: 'filesense_navigate' as ExecutionStep['action'],
          tool: 'filesense_navigate',
          params: {
            intent: decision.intent,
            paths: decision.paths,
            depth: decision.depth,
            maxEntries: filesense?.maxEntries ?? decision.maxEntries,
            maxBytes: filesense?.maxBytes ?? decision.maxBytes,
            timeoutMs: filesense?.timeoutMs ?? decision.timeoutMs,
            output: filesense?.output ?? 'summary',
            writeMode: filesense?.writeMode ?? 'cache',
          },
          phase: 'preparation',
        });
        return [navigateStep, ...steps];
      },
    },
    {
      name: 'phase.repository-management',
      shouldInject: ({ task, steps }) => {
        if (task.type === 'query') {
          return false;
        }
        return steps.some((step) => step.action === 'create_file' || step.action === 'apply_patch');
      },
      apply: ({ task, steps }) => callbacks.injectRepositoryManagementPhase(task, steps),
    },
  ];

  return new PlannerSkillRegistry({ taskSkills, phaseSkills });
}
