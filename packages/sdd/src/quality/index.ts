/**
 * Quality 模块
 */

export {
  ConsistencyAnalyzer,
  type ConsistencyCheckInput,
  type ConsistencyIssue,
  type ConsistencyResult,
  createConsistencyAnalyzer,
} from './consistency-analyzer.js';
export {
  BUILT_IN_RULES,
  createPlanQualityValidator,
  GRANULARITY_RULE,
  HAS_CONCRETE_OUTPUT_RULE,
  NO_PLACEHOLDERS_RULE,
  type PlanQualityResult,
  type PlanQualityRule,
  PlanQualityValidator,
  type PlanQualityViolation,
  SINGLE_ACTION_RULE,
  type TaskStep,
} from './plan-quality.js';
