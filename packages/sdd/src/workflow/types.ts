/**
 * Workflow 类型定义
 * 规格驱动工作流的状态机类型
 */

import type { ArtifactRef } from '../artifacts/types.js';
import type { VerificationEvidence } from '../verification/types.js';

export type WorkflowPhase =
  | 'idle'
  | 'specify'
  | 'clarify'
  | 'plan'
  | 'tasks'
  | 'implement'
  | 'verify'
  | 'complete';

export interface WorkflowState {
  changeId: string;
  phase: WorkflowPhase;
  createdAt: string;
  updatedAt: string;
  artifacts: ArtifactRef[];
  checklistResults: Record<string, ChecklistResultRef>;
  verificationEvidence: VerificationEvidence[];
  clarifyRounds: number;
  metadata: Record<string, unknown>;
}

export interface ChecklistResultRef {
  checklistId: string;
  passed: boolean;
  passRate: number;
  evaluatedAt: string;
}

export interface PhaseGuardResult {
  pass: boolean;
  failures: string[];
  warnings: string[];
}

export type PhaseGuardType = 'checklist' | 'artifact_exists' | 'evidence_exists' | 'custom';

export interface PhaseGuard {
  type: PhaseGuardType;
  checklistId?: string;
  artifactType?: string;
  description?: string;
}

export interface PhaseTransition {
  from: WorkflowPhase;
  to: WorkflowPhase;
  guard: PhaseGuard;
}

export interface WorkflowConfig {
  enabledPhases: WorkflowPhase[];
  gateMode: 'strict' | 'advisory';
  maxClarifyRounds: number;
  taskGranularityMinutes: number;
}

export const DEFAULT_WORKFLOW_CONFIG: WorkflowConfig = {
  enabledPhases: ['idle', 'specify', 'clarify', 'plan', 'tasks', 'implement', 'verify', 'complete'],
  gateMode: 'advisory',
  maxClarifyRounds: 3,
  taskGranularityMinutes: 5,
};
