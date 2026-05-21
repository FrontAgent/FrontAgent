/**
 * SDD Workflow Integration
 * 将规格驱动工作流引擎集成到 FrontAgent 管线中
 */

import { join } from 'node:path';
import {
  type ArtifactStore,
  type ChecklistResult,
  ConsistencyAnalyzer,
  type Constitution,
  ConstitutionParser,
  ConstitutionPromptGenerator,
  createWorkflowEngine,
  DEFAULT_VERIFICATION_POLICY,
  FileArtifactStore,
  type PhaseGuardResult,
  PlanQualityValidator,
  type TaskStep,
  VerificationCollector,
  VerificationEvaluator,
  type VerificationEvidence,
  type VerificationPolicy,
  type WorkflowEngine,
  type WorkflowPhase,
  type WorkflowState,
} from '@frontagent/sdd';
import { logger } from '@frontagent/shared';
import type { SDDWorkflowConfig } from './types.js';

export interface WorkflowIntegrationOptions {
  projectRoot: string;
  config: SDDWorkflowConfig;
  constitutionPath?: string;
  debug?: boolean;
}

export class WorkflowIntegration {
  private engine: WorkflowEngine;
  private artifactStore: ArtifactStore;
  private verificationCollector: VerificationCollector;
  private verificationEvaluator: VerificationEvaluator;
  private planQualityValidator: PlanQualityValidator;
  private consistencyAnalyzer: ConsistencyAnalyzer;
  private constitution?: Constitution;
  private constitutionPrompt?: string;
  private verificationPolicy: VerificationPolicy;
  private debug: boolean;

  constructor(options: WorkflowIntegrationOptions) {
    this.debug = options.debug ?? false;
    const artifactRoot =
      options.config.artifactRoot ?? join(options.projectRoot, '.frontagent', 'specs');

    this.verificationPolicy = {
      ...DEFAULT_VERIFICATION_POLICY,
      ...options.config.verification,
    };

    this.engine = createWorkflowEngine({
      config: options.config.workflow,
    });

    this.artifactStore = new FileArtifactStore(artifactRoot);
    this.verificationCollector = new VerificationCollector();
    this.verificationEvaluator = new VerificationEvaluator(this.verificationPolicy);
    this.planQualityValidator = new PlanQualityValidator();
    this.consistencyAnalyzer = new ConsistencyAnalyzer();

    if (options.constitutionPath) {
      this.loadConstitution(options.constitutionPath);
    }
  }

  private loadConstitution(path: string): void {
    try {
      const parser = new ConstitutionParser();
      const result = parser.parseFile(path);
      if (result.success && result.constitution) {
        this.constitution = result.constitution;
        const generator = new ConstitutionPromptGenerator(this.constitution);
        this.constitutionPrompt = generator.generate();
      }
    } catch (error) {
      if (this.debug) {
        logger.warn('[WorkflowIntegration] Failed to load constitution:', error);
      }
    }
  }

  getConstitutionPrompt(): string | undefined {
    return this.constitutionPrompt;
  }

  getConstitution(): Constitution | undefined {
    return this.constitution;
  }

  startWorkflow(changeId: string): WorkflowState {
    return this.engine.startWorkflow(changeId);
  }

  getState(): WorkflowState | null {
    return this.engine.getState();
  }

  loadState(state: WorkflowState): void {
    this.engine.loadState(state);
  }

  getCurrentPhase(): WorkflowPhase {
    return this.engine.getCurrentPhase();
  }

  canAdvance(targetPhase: WorkflowPhase, content: string): PhaseGuardResult {
    return this.engine.canTransition(targetPhase, content);
  }

  advance(
    targetPhase: WorkflowPhase,
    content: string,
  ): { success: boolean; result: PhaseGuardResult } {
    return this.engine.transition(targetPhase, content);
  }

  getNextPhase(): WorkflowPhase | null {
    return this.engine.getNextPhase();
  }

  runChecklist(checklistId: string, content: string): ChecklistResult | null {
    return this.engine.runChecklist(checklistId, content);
  }

  validatePlanQuality(steps: TaskStep[]): { passed: boolean; violations: string[] } {
    const result = this.planQualityValidator.validate(steps);
    const violations = result.violations
      .filter((v) => v.severity === 'error')
      .map((v) => `[${v.ruleId}] Step "${v.stepId}": ${v.message}`);
    return { passed: violations.length === 0, violations };
  }

  checkConsistency(specContent: string, planContent: string, tasksContent?: string) {
    return this.consistencyAnalyzer.analyze({
      specContent,
      planContent,
      tasksContent,
    });
  }

  markCodeChange(): void {
    this.verificationCollector.markCodeChange();
  }

  collectEvidence(stepResult: {
    stepId: string;
    action: string;
    tool: string;
    output?: unknown;
    success: boolean;
  }): VerificationEvidence | null {
    return this.verificationCollector.collectFromStep(stepResult);
  }

  addEvidence(evidence: VerificationEvidence): void {
    this.engine.addVerificationEvidence(evidence);
  }

  evaluateVerification(requirements: string[]) {
    const state = this.engine.getState();
    const evidence = state?.verificationEvidence ?? [];
    return this.verificationEvaluator.evaluate(evidence, requirements);
  }

  getArtifactStore(): ArtifactStore {
    return this.artifactStore;
  }

  incrementClarifyRound(): number {
    return this.engine.incrementClarifyRound();
  }

  isClarifyExhausted(): boolean {
    return this.engine.isClarifyExhausted();
  }
}

export function createWorkflowIntegration(
  options: WorkflowIntegrationOptions,
): WorkflowIntegration {
  return new WorkflowIntegration(options);
}
