/**
 * Constitution 模块
 */

export {
  type ConstitutionParseResult,
  ConstitutionParser,
  createConstitutionParser,
} from './parser.js';
export {
  ConstitutionPromptGenerator,
  type ConstitutionPromptOptions,
  createConstitutionPromptGenerator,
} from './prompt-generator.js';
export type {
  BehaviorDirective,
  Constitution,
  Principle,
  PrinciplePriority,
  ReviewCriterion,
} from './types.js';
