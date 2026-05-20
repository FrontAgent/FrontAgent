/**
 * Constitution 模块
 */

export type {
  Constitution,
  Principle,
  PrinciplePriority,
  BehaviorDirective,
  ReviewCriterion,
} from './types.js';

export {
  ConstitutionParser,
  createConstitutionParser,
  type ConstitutionParseResult,
} from './parser.js';

export {
  ConstitutionPromptGenerator,
  createConstitutionPromptGenerator,
  type ConstitutionPromptOptions,
} from './prompt-generator.js';
