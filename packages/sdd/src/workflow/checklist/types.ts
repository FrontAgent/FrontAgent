/**
 * Checklist 类型定义
 * "Unit tests for English" — 验证产物完整性的结构化检查
 */

export type ChecklistCategory = 'completeness' | 'clarity' | 'consistency' | 'feasibility';

export type ChecklistEvaluator =
  | { type: 'regex'; pattern: string; invert?: boolean }
  | { type: 'keyword_presence'; keywords: string[]; minMatches?: number }
  | { type: 'section_exists'; heading: string }
  | { type: 'min_length'; chars: number }
  | { type: 'custom'; fn: (content: string, context?: Record<string, unknown>) => boolean };

export interface ChecklistItem {
  id: string;
  question: string;
  category: ChecklistCategory;
  required: boolean;
  evaluator: ChecklistEvaluator;
}

export interface ChecklistItemResult {
  itemId: string;
  question: string;
  passed: boolean;
  required: boolean;
  evidence?: string;
  suggestion?: string;
}

export interface ChecklistResult {
  checklistId: string;
  items: ChecklistItemResult[];
  passRate: number;
  passed: boolean;
  evaluatedAt: string;
}
