/**
 * Verification 模块
 */

export {
  createVerificationCollector,
  type ExecutionStepResult,
  VerificationCollector,
} from './collector.js';
export {
  createVerificationEvaluator,
  VerificationEvaluator,
} from './evaluator.js';
export type {
  EvidenceType,
  VerificationEvidence,
  VerificationPolicy,
  VerificationResult,
} from './types.js';
export { DEFAULT_VERIFICATION_POLICY } from './types.js';
