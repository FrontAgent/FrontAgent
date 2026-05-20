/**
 * 验证证据收集器
 * 从执行结果中提取验证证据
 */

import type { EvidenceType, VerificationEvidence } from './types.js';

export interface ExecutionStepResult {
  stepId: string;
  action: string;
  tool: string;
  success: boolean;
  output?: unknown;
  error?: string;
  timestamp?: string;
}

export class VerificationCollector {
  private lastChangeTimestamp: string;

  constructor() {
    this.lastChangeTimestamp = new Date().toISOString();
  }

  markCodeChange(): void {
    this.lastChangeTimestamp = new Date().toISOString();
  }

  collectFromStep(step: ExecutionStepResult): VerificationEvidence | null {
    const evidenceType = this.classifyStep(step);
    if (!evidenceType || !step.success) return null;

    const timestamp = step.timestamp ?? new Date().toISOString();
    const fresh = timestamp >= this.lastChangeTimestamp;

    return {
      type: evidenceType,
      source: `${step.tool}:${step.stepId}`,
      timestamp,
      fresh,
      details: this.extractDetails(step),
      relatedRequirements: [],
    };
  }

  collectFromPhase(
    steps: ExecutionStepResult[]
  ): VerificationEvidence[] {
    return steps
      .map(step => this.collectFromStep(step))
      .filter((e): e is VerificationEvidence => e !== null);
  }

  private classifyStep(step: ExecutionStepResult): EvidenceType | null {
    if (!step.success) return null;

    const tool = step.tool.toLowerCase();
    const action = step.action.toLowerCase();

    if (tool === 'run_command') {
      const output = typeof step.output === 'object' && step.output !== null
        ? step.output as Record<string, unknown>
        : {};
      const command = typeof output.command === 'string' ? output.command : '';

      if (/\b(jest|vitest|mocha|pytest|test)\b/.test(command)) return 'test_pass';
      if (/\b(tsc|typecheck|type-check)\b/.test(command)) return 'type_check';
      if (/\b(eslint|lint|biome)\b/.test(command)) return 'lint_pass';
      if (/\b(build|vite build|webpack|esbuild)\b/.test(command)) return 'build_success';
    }

    if (action === 'browser_screenshot' || action === 'browser_navigate') {
      return 'runtime_check';
    }

    return null;
  }

  private extractDetails(step: ExecutionStepResult): string {
    if (typeof step.output === 'string') {
      return step.output.slice(0, 500);
    }
    if (step.output && typeof step.output === 'object') {
      const out = step.output as Record<string, unknown>;
      if (typeof out.output === 'string') return out.output.slice(0, 500);
      if (typeof out.stdout === 'string') return out.stdout.slice(0, 500);
    }
    return `${step.tool} completed successfully`;
  }
}

export function createVerificationCollector(): VerificationCollector {
  return new VerificationCollector();
}
