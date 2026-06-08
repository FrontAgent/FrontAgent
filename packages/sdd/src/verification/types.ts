/**
 * Verification 类型定义
 * 验证纪律：完成前必须有证据（Superpowers: "Evidence before claims, always"）
 */

export type EvidenceType =
  | 'test_pass'
  | 'type_check'
  | 'lint_pass'
  | 'build_success'
  | 'runtime_check'
  | 'manual_confirm';

export interface VerificationEvidence {
  type: EvidenceType;
  source: string;
  timestamp: string;
  fresh: boolean;
  details: string;
  relatedRequirements: string[];
}

export interface VerificationResult {
  complete: boolean;
  coveredRequirements: string[];
  uncoveredRequirements: string[];
  evidence: VerificationEvidence[];
  verdict: 'verified' | 'partial' | 'unverified';
  coverageRatio: number;
}

export interface VerificationPolicy {
  requireFreshEvidence: boolean;
  minCoverageRatio: number;
  strongEvidenceTypes: EvidenceType[];
}

export const DEFAULT_VERIFICATION_POLICY: VerificationPolicy = {
  requireFreshEvidence: true,
  minCoverageRatio: 0.8,
  strongEvidenceTypes: ['test_pass', 'type_check', 'build_success'],
};
