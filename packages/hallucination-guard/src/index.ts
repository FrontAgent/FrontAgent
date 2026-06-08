/**
 * @frontagent/hallucination-guard - 幻觉防控模块
 */

export {
  checkFileExistence,
  checkFilesExistence,
  type FileExistenceCheckInput,
} from './checks/file-existence.js';
export {
  checkAllImports,
  checkImportValidity,
  extractImports,
  type ImportValidityCheckInput,
} from './checks/import-validity.js';
export {
  checkActionsCompliance,
  checkSDDCompliance,
  type SDDComplianceCheckInput,
} from './checks/sdd-compliance.js';

export {
  checkSyntaxValidity,
  type SyntaxValidityCheckInput,
} from './checks/syntax-validity.js';
export {
  type AgentOutput,
  createHallucinationGuard,
  type GuardConfig,
  HallucinationGuard,
} from './guard.js';
