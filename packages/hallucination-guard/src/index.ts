/**
 * @frontagent/hallucination-guard - 幻觉防控模块
 */

export {
  HallucinationGuard,
  createHallucinationGuard,
  type AgentOutput,
  type GuardConfig
} from './guard.js';

export {
  checkFileExistence,
  checkFilesExistence,
  type FileExistenceCheckInput
} from './checks/file-existence.js';

export {
  checkImportValidity,
  checkAllImports,
  extractImports,
  type ImportValidityCheckInput
} from './checks/import-validity.js';

export {
  checkSyntaxValidity,
  type SyntaxValidityCheckInput
} from './checks/syntax-validity.js';

export {
  checkSDDCompliance,
  checkActionsCompliance,
  type SDDComplianceCheckInput
} from './checks/sdd-compliance.js';

