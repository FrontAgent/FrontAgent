/**
 * 计划质量验证器
 * 借鉴 Superpowers: No-placeholders、原子粒度、单一动作规则
 */

export interface TaskStep {
  id: string;
  description: string;
  estimatedMinutes?: number;
  parallel?: boolean;
  dependencies?: string[];
  commands?: string[];
  files?: string[];
  content?: string;
}

export interface PlanQualityViolation {
  ruleId: string;
  stepId: string;
  message: string;
  severity: 'error' | 'warning';
  suggestion?: string;
}

export interface PlanQualityResult {
  passed: boolean;
  violations: PlanQualityViolation[];
  stats: {
    totalSteps: number;
    violationCount: number;
    errorCount: number;
    warningCount: number;
  };
}

export interface PlanQualityRule {
  id: string;
  name: string;
  severity: 'error' | 'warning';
  check: (step: TaskStep, allSteps: TaskStep[]) => PlanQualityViolation | null;
}

const PLACEHOLDER_PATTERNS = [
  /\b(TBD|TODO|FIXME|HACK|XXX)\b/i,
  /\b(implement later|fill in|placeholder|to be determined)\b/i,
  /\b(add appropriate|add necessary|add relevant)\b/i,
  /\.\.\.\s*(here|code|implementation|logic)/i,
  /\b(etc\.?|and so on|and more)\b/i,
];

export const NO_PLACEHOLDERS_RULE: PlanQualityRule = {
  id: 'no-placeholders',
  name: 'No Placeholders',
  severity: 'error',
  check(step) {
    const text = [step.description, step.content, ...(step.commands ?? [])].filter(Boolean).join(' ');
    for (const pattern of PLACEHOLDER_PATTERNS) {
      const match = pattern.exec(text);
      if (match) {
        return {
          ruleId: 'no-placeholders',
          stepId: step.id,
          message: `Step contains placeholder language: "${match[0]}"`,
          severity: 'error',
          suggestion: 'Replace with concrete implementation details, actual code, or specific commands',
        };
      }
    }
    return null;
  },
};

export const GRANULARITY_RULE: PlanQualityRule = {
  id: 'granularity',
  name: 'Bite-Sized Granularity',
  severity: 'warning',
  check(step) {
    if (step.estimatedMinutes && step.estimatedMinutes > 10) {
      return {
        ruleId: 'granularity',
        stepId: step.id,
        message: `Step estimated at ${step.estimatedMinutes} minutes (target: 2-5 minutes)`,
        severity: 'warning',
        suggestion: 'Break this step into smaller atomic actions',
      };
    }
    return null;
  },
};

export const SINGLE_ACTION_RULE: PlanQualityRule = {
  id: 'single-action',
  name: 'Single Action Per Step',
  severity: 'warning',
  check(step) {
    const actionVerbs = step.description.match(/\b(create|modify|update|delete|add|remove|refactor|test|run|install)\b/gi);
    if (actionVerbs && actionVerbs.length > 2) {
      return {
        ruleId: 'single-action',
        stepId: step.id,
        message: `Step appears to contain multiple actions: ${[...new Set(actionVerbs)].join(', ')}`,
        severity: 'warning',
        suggestion: 'Each step should perform exactly one action',
      };
    }
    return null;
  },
};

export const HAS_CONCRETE_OUTPUT_RULE: PlanQualityRule = {
  id: 'has-concrete-output',
  name: 'Concrete Output',
  severity: 'warning',
  check(step) {
    const hasFiles = step.files && step.files.length > 0;
    const hasCommands = step.commands && step.commands.length > 0;
    const hasContent = step.content && step.content.trim().length > 0;
    if (!hasFiles && !hasCommands && !hasContent) {
      return {
        ruleId: 'has-concrete-output',
        stepId: step.id,
        message: 'Step has no concrete output (no files, commands, or content specified)',
        severity: 'warning',
        suggestion: 'Add specific file paths, commands to run, or code content',
      };
    }
    return null;
  },
};

export const BUILT_IN_RULES: PlanQualityRule[] = [
  NO_PLACEHOLDERS_RULE,
  GRANULARITY_RULE,
  SINGLE_ACTION_RULE,
  HAS_CONCRETE_OUTPUT_RULE,
];

export class PlanQualityValidator {
  private rules: PlanQualityRule[];

  constructor(rules?: PlanQualityRule[]) {
    this.rules = rules ?? BUILT_IN_RULES;
  }

  validate(steps: TaskStep[]): PlanQualityResult {
    const violations: PlanQualityViolation[] = [];

    for (const step of steps) {
      for (const rule of this.rules) {
        const violation = rule.check(step, steps);
        if (violation) {
          violations.push(violation);
        }
      }
    }

    const errorCount = violations.filter(v => v.severity === 'error').length;
    const warningCount = violations.filter(v => v.severity === 'warning').length;

    return {
      passed: errorCount === 0,
      violations,
      stats: {
        totalSteps: steps.length,
        violationCount: violations.length,
        errorCount,
        warningCount,
      },
    };
  }

  addRule(rule: PlanQualityRule): void {
    this.rules.push(rule);
  }
}

export function createPlanQualityValidator(rules?: PlanQualityRule[]): PlanQualityValidator {
  return new PlanQualityValidator(rules);
}
