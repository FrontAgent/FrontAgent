/**
 * Workflow Engine — 规格驱动工作流的状态机
 * 管理阶段转换、guard 评估、状态持久化
 */

import type { ArtifactStore } from '../artifacts/types.js';
import type { VerificationEvidence } from '../verification/types.js';
import { BUILT_IN_CHECKLISTS } from './checklist/built-in.js';
import type { ChecklistResult } from './checklist/types.js';
import { ChecklistValidator } from './checklist/validator.js';
import type {
  PhaseGuard,
  PhaseGuardResult,
  PhaseTransition,
  WorkflowConfig,
  WorkflowPhase,
  WorkflowState,
} from './types.js';

export interface WorkflowEngineOptions {
  config?: Partial<WorkflowConfig>;
  artifactStore?: ArtifactStore;
  onPhaseChange?: (from: WorkflowPhase, to: WorkflowPhase, state: WorkflowState) => void;
}

const PHASE_TRANSITIONS: PhaseTransition[] = [
  { from: 'idle', to: 'specify', guard: { type: 'custom', description: 'Always allowed' } },
  {
    from: 'specify',
    to: 'clarify',
    guard: { type: 'checklist', checklistId: 'spec-completeness' },
  },
  {
    from: 'clarify',
    to: 'plan',
    guard: { type: 'custom', description: 'Clarify rounds exhausted or no open questions' },
  },
  { from: 'plan', to: 'tasks', guard: { type: 'checklist', checklistId: 'plan-quality' } },
  { from: 'tasks', to: 'implement', guard: { type: 'checklist', checklistId: 'task-readiness' } },
  {
    from: 'implement',
    to: 'verify',
    guard: { type: 'artifact_exists', artifactType: 'implementation-plan' },
  },
  {
    from: 'verify',
    to: 'complete',
    guard: { type: 'checklist', checklistId: 'verification-coverage' },
  },
];

export class WorkflowEngine {
  private state: WorkflowState | null = null;
  private config: WorkflowConfig;
  private checklistValidator: ChecklistValidator;
  private onPhaseChange?: WorkflowEngineOptions['onPhaseChange'];

  constructor(options: WorkflowEngineOptions = {}) {
    this.config = { ...DEFAULT_WORKFLOW_CONFIG_VALUES, ...options.config };
    this.checklistValidator = new ChecklistValidator();
    this.onPhaseChange = options.onPhaseChange;
  }

  startWorkflow(changeId: string): WorkflowState {
    const now = new Date().toISOString();
    this.state = {
      changeId,
      phase: 'idle',
      createdAt: now,
      updatedAt: now,
      artifacts: [],
      checklistResults: {},
      verificationEvidence: [],
      clarifyRounds: 0,
      metadata: {},
    };
    return this.state;
  }

  getState(): WorkflowState | null {
    return this.state;
  }

  loadState(state: WorkflowState): void {
    this.state = state;
  }

  getCurrentPhase(): WorkflowPhase {
    return this.state?.phase ?? 'idle';
  }

  canTransition(targetPhase: WorkflowPhase, content: string): PhaseGuardResult {
    if (!this.state) {
      return { pass: false, failures: ['No active workflow'], warnings: [] };
    }

    const transition = PHASE_TRANSITIONS.find(
      (t) => t.from === this.state!.phase && t.to === targetPhase,
    );

    if (!transition) {
      return {
        pass: false,
        failures: [`No valid transition from "${this.state.phase}" to "${targetPhase}"`],
        warnings: [],
      };
    }

    if (!this.config.enabledPhases.includes(targetPhase)) {
      return {
        pass: true,
        failures: [],
        warnings: [`Phase "${targetPhase}" is disabled, skipping`],
      };
    }

    return this.evaluateGuard(transition.guard, content);
  }

  transition(
    targetPhase: WorkflowPhase,
    content: string,
  ): { success: boolean; result: PhaseGuardResult } {
    const guardResult = this.canTransition(targetPhase, content);

    if (!guardResult.pass && this.config.gateMode === 'strict') {
      return { success: false, result: guardResult };
    }

    const previousPhase = this.state!.phase;
    this.state!.phase = targetPhase;
    this.state!.updatedAt = new Date().toISOString();

    this.onPhaseChange?.(previousPhase, targetPhase, this.state!);

    return { success: true, result: guardResult };
  }

  addVerificationEvidence(evidence: VerificationEvidence): void {
    if (this.state) {
      this.state.verificationEvidence.push(evidence);
      this.state.updatedAt = new Date().toISOString();
    }
  }

  incrementClarifyRound(): number {
    if (this.state) {
      this.state.clarifyRounds += 1;
      this.state.updatedAt = new Date().toISOString();
    }
    return this.state?.clarifyRounds ?? 0;
  }

  isClarifyExhausted(): boolean {
    return (this.state?.clarifyRounds ?? 0) >= this.config.maxClarifyRounds;
  }

  runChecklist(checklistId: string, content: string): ChecklistResult | null {
    const items = BUILT_IN_CHECKLISTS[checklistId];
    if (!items) return null;

    const result = this.checklistValidator.evaluate(checklistId, items, content);

    if (this.state) {
      this.state.checklistResults[checklistId] = {
        checklistId,
        passed: result.passed,
        passRate: result.passRate,
        evaluatedAt: result.evaluatedAt,
      };
      this.state.updatedAt = new Date().toISOString();
    }

    return result;
  }

  getNextPhase(): WorkflowPhase | null {
    if (!this.state) return null;
    const transition = PHASE_TRANSITIONS.find((t) => t.from === this.state!.phase);
    if (!transition) return null;

    if (!this.config.enabledPhases.includes(transition.to)) {
      const idx = PHASE_TRANSITIONS.indexOf(transition);
      for (let i = idx + 1; i < PHASE_TRANSITIONS.length; i++) {
        if (this.config.enabledPhases.includes(PHASE_TRANSITIONS[i].to)) {
          return PHASE_TRANSITIONS[i].to;
        }
      }
      return null;
    }

    return transition.to;
  }

  private evaluateGuard(guard: PhaseGuard, content: string): PhaseGuardResult {
    switch (guard.type) {
      case 'checklist': {
        const result = this.runChecklist(guard.checklistId!, content);
        if (!result) {
          return {
            pass: true,
            failures: [],
            warnings: [`Checklist "${guard.checklistId}" not found, skipping`],
          };
        }
        const failures = result.items
          .filter((i) => i.required && !i.passed)
          .map((i) => i.suggestion ?? i.question);
        const warnings = result.items
          .filter((i) => !i.required && !i.passed)
          .map((i) => i.suggestion ?? i.question);
        return { pass: result.passed, failures, warnings };
      }

      case 'artifact_exists': {
        const hasArtifact = this.state!.artifacts.some((a) => a.type === guard.artifactType);
        return hasArtifact
          ? { pass: true, failures: [], warnings: [] }
          : {
              pass: false,
              failures: [`Required artifact "${guard.artifactType}" not found`],
              warnings: [],
            };
      }

      case 'evidence_exists': {
        const hasEvidence = this.state!.verificationEvidence.length > 0;
        return hasEvidence
          ? { pass: true, failures: [], warnings: [] }
          : { pass: false, failures: ['No verification evidence collected'], warnings: [] };
      }

      case 'custom':
        return { pass: true, failures: [], warnings: [] };

      default:
        return { pass: true, failures: [], warnings: [] };
    }
  }
}

const DEFAULT_WORKFLOW_CONFIG_VALUES: WorkflowConfig = {
  enabledPhases: ['idle', 'specify', 'clarify', 'plan', 'tasks', 'implement', 'verify', 'complete'],
  gateMode: 'advisory',
  maxClarifyRounds: 3,
  taskGranularityMinutes: 5,
};

export function createWorkflowEngine(options?: WorkflowEngineOptions): WorkflowEngine {
  return new WorkflowEngine(options);
}
