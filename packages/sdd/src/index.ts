/**
 * @frontagent/sdd - SDD 控制层
 *
 * 提供 SDD (Specification Driven Development) 的解析、验证和约束生成功能
 */

export { SDDParser, createSDDParser, type ParseResult } from './parser.js';
export { SDDValidator, createSDDValidator, type AgentAction, type ValidationResult } from './validator.js';
export { SDDPromptGenerator, createPromptGenerator, type PromptGeneratorOptions } from './prompt-generator.js';
export { SDDSchema, defaultSDDConfig } from './schema.js';

// Re-export shared types
export type {
  SDDConfig,
  ProjectConfig,
  TechStackConfig,
  DirectoryStructureConfig,
  DirectoryRule,
  ModuleBoundary,
  NamingConventions,
  CodeQualityConfig,
  ModificationRules,
  ApprovalRule,
  ConstraintViolation
} from '@frontagent/shared';

