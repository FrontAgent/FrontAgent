import { describe, expect, it } from 'vitest';
import {
  BUILT_IN_RULES,
  GRANULARITY_RULE,
  HAS_CONCRETE_OUTPUT_RULE,
  NO_PLACEHOLDERS_RULE,
  type PlanQualityRule,
  PlanQualityValidator,
  SINGLE_ACTION_RULE,
  type TaskStep,
} from './plan-quality.js';

function makeStep(overrides: Partial<TaskStep> = {}): TaskStep {
  return {
    id: 'step-1',
    description: 'Create the Button component',
    files: ['src/components/Button.tsx'],
    ...overrides,
  };
}

describe('NO_PLACEHOLDERS_RULE', () => {
  it('passes when no placeholder language is present', () => {
    const step = makeStep({ description: 'Create src/Button.tsx with click handler' });
    expect(NO_PLACEHOLDERS_RULE.check(step, [])).toBeNull();
  });

  it('detects TBD in description', () => {
    const step = makeStep({ description: 'Implement TBD logic' });
    const result = NO_PLACEHOLDERS_RULE.check(step, []);
    expect(result).not.toBeNull();
    expect(result!.ruleId).toBe('no-placeholders');
    expect(result!.message).toContain('TBD');
  });

  it('detects TODO in commands', () => {
    const step = makeStep({ commands: ['echo "TODO: fix this"'] });
    const result = NO_PLACEHOLDERS_RULE.check(step, []);
    expect(result).not.toBeNull();
  });

  it('detects "implement later" in content', () => {
    const step = makeStep({ content: 'implement later when API is ready' });
    const result = NO_PLACEHOLDERS_RULE.check(step, []);
    expect(result).not.toBeNull();
  });

  it('detects "add appropriate" pattern', () => {
    const step = makeStep({ description: 'Add appropriate error handling' });
    const result = NO_PLACEHOLDERS_RULE.check(step, []);
    expect(result).not.toBeNull();
  });

  it('detects "... here" pattern', () => {
    const step = makeStep({ content: '... implementation here' });
    const result = NO_PLACEHOLDERS_RULE.check(step, []);
    expect(result).not.toBeNull();
  });

  it('detects "etc." pattern', () => {
    const step = makeStep({ description: 'Add validation, logging, etc.' });
    const result = NO_PLACEHOLDERS_RULE.check(step, []);
    expect(result).not.toBeNull();
  });

  it('is case-insensitive', () => {
    const step = makeStep({ description: 'fixme: handle edge case' });
    const result = NO_PLACEHOLDERS_RULE.check(step, []);
    expect(result).not.toBeNull();
  });
});

describe('GRANULARITY_RULE', () => {
  it('passes when estimatedMinutes is within limit', () => {
    const step = makeStep({ estimatedMinutes: 5 });
    expect(GRANULARITY_RULE.check(step, [])).toBeNull();
  });

  it('passes when estimatedMinutes is not set', () => {
    const step = makeStep();
    expect(GRANULARITY_RULE.check(step, [])).toBeNull();
  });

  it('flags steps exceeding 10 minutes', () => {
    const step = makeStep({ estimatedMinutes: 15 });
    const result = GRANULARITY_RULE.check(step, []);
    expect(result).not.toBeNull();
    expect(result!.ruleId).toBe('granularity');
    expect(result!.message).toContain('15 minutes');
  });

  it('passes at exactly 10 minutes', () => {
    const step = makeStep({ estimatedMinutes: 10 });
    expect(GRANULARITY_RULE.check(step, [])).toBeNull();
  });
});

describe('SINGLE_ACTION_RULE', () => {
  it('passes with a single action verb', () => {
    const step = makeStep({ description: 'Create the Button component' });
    expect(SINGLE_ACTION_RULE.check(step, [])).toBeNull();
  });

  it('passes with two action verbs', () => {
    const step = makeStep({ description: 'Create and test the component' });
    expect(SINGLE_ACTION_RULE.check(step, [])).toBeNull();
  });

  it('flags three or more action verbs', () => {
    const step = makeStep({
      description: 'Create the component, add tests, and refactor the module',
    });
    const result = SINGLE_ACTION_RULE.check(step, []);
    expect(result).not.toBeNull();
    expect(result!.ruleId).toBe('single-action');
  });

  it('deduplicates repeated verbs in the message', () => {
    const step = makeStep({
      description: 'Create file, update config, delete old file, install deps',
    });
    const result = SINGLE_ACTION_RULE.check(step, []);
    expect(result).not.toBeNull();
  });
});

describe('HAS_CONCRETE_OUTPUT_RULE', () => {
  it('passes when files are specified', () => {
    const step = makeStep({ files: ['src/index.ts'] });
    expect(HAS_CONCRETE_OUTPUT_RULE.check(step, [])).toBeNull();
  });

  it('passes when commands are specified', () => {
    const step = makeStep({ files: undefined, commands: ['npm install zod'] });
    expect(HAS_CONCRETE_OUTPUT_RULE.check(step, [])).toBeNull();
  });

  it('passes when content is specified', () => {
    const step = makeStep({ files: undefined, content: 'export const x = 1;' });
    expect(HAS_CONCRETE_OUTPUT_RULE.check(step, [])).toBeNull();
  });

  it('flags steps with no concrete output', () => {
    const step = makeStep({ files: undefined, commands: undefined, content: undefined });
    const result = HAS_CONCRETE_OUTPUT_RULE.check(step, []);
    expect(result).not.toBeNull();
    expect(result!.ruleId).toBe('has-concrete-output');
  });

  it('flags steps with empty arrays and whitespace content', () => {
    const step = makeStep({ files: [], commands: [], content: '   ' });
    const result = HAS_CONCRETE_OUTPUT_RULE.check(step, []);
    expect(result).not.toBeNull();
  });
});

describe('PlanQualityValidator', () => {
  it('passes a valid plan with no violations', () => {
    const validator = new PlanQualityValidator();
    const result = validator.validate([
      makeStep({ id: 's1', description: 'Create Button component', files: ['src/Button.tsx'] }),
      makeStep({ id: 's2', description: 'Add unit test', files: ['src/Button.test.tsx'] }),
    ]);
    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
    expect(result.stats.totalSteps).toBe(2);
  });

  it('fails when errors are present', () => {
    const validator = new PlanQualityValidator();
    const result = validator.validate([
      makeStep({ id: 's1', description: 'TBD: implement feature', files: ['src/x.ts'] }),
    ]);
    expect(result.passed).toBe(false);
    expect(result.stats.errorCount).toBeGreaterThan(0);
  });

  it('passes with warnings only (no errors)', () => {
    const validator = new PlanQualityValidator();
    const result = validator.validate([
      makeStep({ id: 's1', estimatedMinutes: 20, files: ['src/x.ts'] }),
    ]);
    expect(result.passed).toBe(true);
    expect(result.stats.warningCount).toBeGreaterThan(0);
  });

  it('accepts custom rules', () => {
    const customRule: PlanQualityRule = {
      id: 'custom',
      name: 'Custom Rule',
      severity: 'error',
      check: (step) =>
        step.id === 'bad'
          ? { ruleId: 'custom', stepId: step.id, message: 'Bad step', severity: 'error' }
          : null,
    };
    const validator = new PlanQualityValidator([customRule]);
    const result = validator.validate([makeStep({ id: 'bad' })]);
    expect(result.passed).toBe(false);
    expect(result.violations[0].ruleId).toBe('custom');
  });

  it('addRule appends to existing rules', () => {
    const validator = new PlanQualityValidator([]);
    validator.addRule(BUILT_IN_RULES[0]);
    const result = validator.validate([makeStep({ id: 's1', description: 'TODO: fix' })]);
    expect(result.violations).toHaveLength(1);
  });

  it('returns correct stats', () => {
    const validator = new PlanQualityValidator();
    const result = validator.validate([
      makeStep({ id: 's1', description: 'TBD placeholder', files: ['a.ts'] }),
      makeStep({ id: 's2', estimatedMinutes: 30, files: ['b.ts'] }),
      makeStep({ id: 's3', description: 'Valid step', files: ['c.ts'] }),
    ]);
    expect(result.stats.totalSteps).toBe(3);
    expect(result.stats.errorCount).toBe(1);
    expect(result.stats.warningCount).toBeGreaterThanOrEqual(1);
    expect(result.stats.violationCount).toBe(result.stats.errorCount + result.stats.warningCount);
  });
});
