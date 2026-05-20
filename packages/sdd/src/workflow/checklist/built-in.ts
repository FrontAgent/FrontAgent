/**
 * 内置 Checklist 定义
 * 每个阶段转换的质量门禁
 */

import type { ChecklistItem } from './types.js';

export const SPEC_COMPLETENESS_CHECKLIST: ChecklistItem[] = [
  {
    id: 'has-acceptance-criteria',
    question: 'Does the spec define measurable acceptance criteria?',
    category: 'completeness',
    required: true,
    evaluator: {
      type: 'keyword_presence',
      keywords: ['acceptance criteria', 'acceptance', '验收标准', '验收条件', 'AC-'],
      minMatches: 1,
    },
  },
  {
    id: 'has-scope',
    question: 'Is the scope clearly bounded?',
    category: 'clarity',
    required: true,
    evaluator: {
      type: 'keyword_presence',
      keywords: ['scope', 'out of scope', 'not included', '范围', '不包含'],
      minMatches: 1,
    },
  },
  {
    id: 'has-description',
    question: 'Does the spec have sufficient detail?',
    category: 'completeness',
    required: true,
    evaluator: { type: 'min_length', chars: 100 },
  },
  {
    id: 'no-ambiguous-terms',
    question: 'Are there undefined ambiguous terms (TBD/TBA)?',
    category: 'clarity',
    required: false,
    evaluator: { type: 'regex', pattern: '\\b(TBD|TBA|to be decided|待定)\\b', invert: true },
  },
];

export const PLAN_QUALITY_CHECKLIST: ChecklistItem[] = [
  {
    id: 'no-placeholders',
    question: 'Does every step contain concrete actions (no TBD/TODO)?',
    category: 'completeness',
    required: true,
    evaluator: {
      type: 'regex',
      pattern: '\\b(TBD|TODO|implement later|fill in|placeholder|待实现)\\b',
      invert: true,
    },
  },
  {
    id: 'has-file-paths',
    question: 'Does the plan reference specific file paths?',
    category: 'feasibility',
    required: true,
    evaluator: {
      type: 'regex',
      pattern: '(src/|\\./|\\w+\\.\\w{2,4})',
    },
  },
  {
    id: 'has-steps',
    question: 'Does the plan contain actionable steps?',
    category: 'completeness',
    required: true,
    evaluator: {
      type: 'keyword_presence',
      keywords: ['step', '步骤', '- [', '1.', '2.'],
      minMatches: 2,
    },
  },
];

export const TASK_READINESS_CHECKLIST: ChecklistItem[] = [
  {
    id: 'has-commands-or-code',
    question: 'Does each task have concrete commands or code?',
    category: 'feasibility',
    required: true,
    evaluator: {
      type: 'regex',
      pattern: '```|`[^`]+`|\\$\\s',
    },
  },
  {
    id: 'has-dependencies',
    question: 'Are task dependencies clearly marked?',
    category: 'consistency',
    required: false,
    evaluator: {
      type: 'keyword_presence',
      keywords: ['depends on', 'after', 'requires', '依赖', '前置', '[P]'],
    },
  },
];

export const VERIFICATION_COVERAGE_CHECKLIST: ChecklistItem[] = [
  {
    id: 'has-evidence',
    question: 'Is there at least one piece of verification evidence?',
    category: 'completeness',
    required: true,
    evaluator: {
      type: 'keyword_presence',
      keywords: ['pass', 'success', '✅', 'verified', '通过'],
      minMatches: 1,
    },
  },
  {
    id: 'has-test-evidence',
    question: 'Is there test-based evidence?',
    category: 'completeness',
    required: false,
    evaluator: {
      type: 'keyword_presence',
      keywords: ['test', 'spec', 'assert', '测试'],
    },
  },
];

export const BUILT_IN_CHECKLISTS: Record<string, ChecklistItem[]> = {
  'spec-completeness': SPEC_COMPLETENESS_CHECKLIST,
  'plan-quality': PLAN_QUALITY_CHECKLIST,
  'task-readiness': TASK_READINESS_CHECKLIST,
  'verification-coverage': VERIFICATION_COVERAGE_CHECKLIST,
};
