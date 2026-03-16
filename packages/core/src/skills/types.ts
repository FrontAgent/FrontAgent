import type { AgentTask, ExecutionStep, ValidationRule } from '@frontagent/shared';

export interface PlannerContextSnapshot {
  readonly files: ReadonlyMap<string, string>;
  readonly pageStructure?: unknown;
  readonly ragResults?: readonly string[];
  readonly projectStructure?: string;
  readonly devServerPort?: number;
}

export interface PlannerStepFactory {
  createStep(options: {
    description: string;
    action: ExecutionStep['action'];
    tool: string;
    params: Record<string, unknown>;
    dependencies?: string[];
    validation?: ValidationRule[];
    phase?: string;
  }): ExecutionStep;
}

export interface TaskPlanningSkill {
  name: string;
  supports(task: AgentTask): boolean;
  plan(input: {
    task: AgentTask;
    context: PlannerContextSnapshot;
    stepFactory: PlannerStepFactory;
  }): ExecutionStep[];
}

export interface PhaseInjectionSkill {
  name: string;
  shouldInject(input: { task: AgentTask; steps: ExecutionStep[] }): boolean;
  apply(input: {
    task: AgentTask;
    steps: ExecutionStep[];
    stepFactory: PlannerStepFactory;
  }): ExecutionStep[];
}

export interface PlannerSkillsLayerSnapshot {
  taskSkills: string[];
  phaseSkills: string[];
}
