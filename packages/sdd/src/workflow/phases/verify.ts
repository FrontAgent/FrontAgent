/**
 * Verify Phase — 验证协议
 * 确保实现有充分的证据支撑（"Evidence before claims, always"）
 */

import type { VerificationEvidence, VerificationPolicy } from '../../verification/types.js';
import type { WorkflowState } from '../types.js';

export interface VerifyInput {
  requirements: string[];
  evidence: VerificationEvidence[];
  policy: VerificationPolicy;
}

export interface VerifyOutput {
  verdict: 'verified' | 'partial' | 'unverified';
  coverageRatio: number;
  coveredRequirements: string[];
  uncoveredRequirements: string[];
  suggestedActions: string[];
}

export function generateVerifyPrompt(state: WorkflowState, requirements: string[]): string {
  const evidenceSummary = state.verificationEvidence
    .map(e => `- [${e.type}] ${e.source}: ${e.details} (fresh: ${e.fresh})`)
    .join('\n');

  const parts: string[] = [
    '## Verification Phase',
    '',
    'Review the evidence collected and determine if all requirements are verified.',
    '',
    '### Requirements to Verify',
    ...requirements.map((r, i) => `${i + 1}. ${r}`),
    '',
    '### Evidence Collected',
    evidenceSummary || '(No evidence collected yet)',
    '',
    '### Instructions',
    'For each uncovered requirement, suggest a specific verification action:',
    '- Run a specific test command',
    '- Check type compilation',
    '- Verify runtime behavior',
    '- Request manual confirmation',
  ];

  return parts.join('\n');
}

export function evaluateVerification(input: VerifyInput): VerifyOutput {
  const { requirements, evidence, policy } = input;

  if (requirements.length === 0) {
    return {
      verdict: 'verified',
      coverageRatio: 1,
      coveredRequirements: [],
      uncoveredRequirements: [],
      suggestedActions: [],
    };
  }

  const freshEvidence = policy.requireFreshEvidence
    ? evidence.filter(e => e.fresh)
    : evidence;

  const coveredRequirements: string[] = [];
  const uncoveredRequirements: string[] = [];

  for (const req of requirements) {
    const reqLower = req.toLowerCase();
    const covered = freshEvidence.some(e =>
      e.relatedRequirements.some(r => r.toLowerCase().includes(reqLower) || reqLower.includes(r.toLowerCase()))
    );
    if (covered) {
      coveredRequirements.push(req);
    } else {
      uncoveredRequirements.push(req);
    }
  }

  const coverageRatio = coveredRequirements.length / requirements.length;

  let verdict: VerifyOutput['verdict'];
  if (coverageRatio >= policy.minCoverageRatio) {
    verdict = 'verified';
  } else if (coverageRatio > 0) {
    verdict = 'partial';
  } else {
    verdict = 'unverified';
  }

  const suggestedActions = uncoveredRequirements.map(req =>
    `Run verification for: "${req}"`
  );

  return { verdict, coverageRatio, coveredRequirements, uncoveredRequirements, suggestedActions };
}
