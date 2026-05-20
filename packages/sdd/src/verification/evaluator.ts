/**
 * 验证评估器
 * 评估收集到的证据是否满足验证策略
 */

import type { VerificationEvidence, VerificationPolicy, VerificationResult } from './types.js';
import { DEFAULT_VERIFICATION_POLICY } from './types.js';

export class VerificationEvaluator {
  private policy: VerificationPolicy;

  constructor(policy?: Partial<VerificationPolicy>) {
    this.policy = { ...DEFAULT_VERIFICATION_POLICY, ...policy };
  }

  evaluate(
    evidence: VerificationEvidence[],
    requirements: string[]
  ): VerificationResult {
    if (requirements.length === 0) {
      return {
        complete: evidence.length > 0,
        coveredRequirements: [],
        uncoveredRequirements: [],
        evidence,
        verdict: evidence.length > 0 ? 'verified' : 'unverified',
        coverageRatio: evidence.length > 0 ? 1 : 0,
      };
    }

    const validEvidence = this.policy.requireFreshEvidence
      ? evidence.filter(e => e.fresh)
      : evidence;

    const coveredSet = new Set<string>();
    for (const e of validEvidence) {
      for (const req of e.relatedRequirements) {
        coveredSet.add(req);
      }
    }

    // If evidence doesn't explicitly link to requirements but we have strong evidence,
    // consider it as general coverage
    const hasStrongEvidence = validEvidence.some(
      e => this.policy.strongEvidenceTypes.includes(e.type)
    );

    const coveredRequirements = requirements.filter(r => coveredSet.has(r));
    const uncoveredRequirements = requirements.filter(r => !coveredSet.has(r));

    let coverageRatio: number;
    if (coveredRequirements.length > 0) {
      coverageRatio = coveredRequirements.length / requirements.length;
    } else if (hasStrongEvidence) {
      // Strong evidence without explicit requirement links counts as partial coverage
      coverageRatio = Math.min(0.5, validEvidence.length * 0.1);
    } else {
      coverageRatio = 0;
    }

    let verdict: VerificationResult['verdict'];
    if (coverageRatio >= this.policy.minCoverageRatio) {
      verdict = 'verified';
    } else if (coverageRatio > 0 || hasStrongEvidence) {
      verdict = 'partial';
    } else {
      verdict = 'unverified';
    }

    return {
      complete: verdict === 'verified',
      coveredRequirements,
      uncoveredRequirements,
      evidence: validEvidence,
      verdict,
      coverageRatio,
    };
  }

  updatePolicy(policy: Partial<VerificationPolicy>): void {
    this.policy = { ...this.policy, ...policy };
  }

  getPolicy(): VerificationPolicy {
    return { ...this.policy };
  }
}

export function createVerificationEvaluator(
  policy?: Partial<VerificationPolicy>
): VerificationEvaluator {
  return new VerificationEvaluator(policy);
}
