/**
 * Checklist 评估引擎
 */

import type {
  ChecklistEvaluator,
  ChecklistItem,
  ChecklistItemResult,
  ChecklistResult,
} from './types.js';

export class ChecklistValidator {
  evaluate(
    checklistId: string,
    items: ChecklistItem[],
    content: string,
    context?: Record<string, unknown>,
  ): ChecklistResult {
    const results: ChecklistItemResult[] = items.map((item) => {
      const passed = this.evaluateItem(item.evaluator, content, context);
      return {
        itemId: item.id,
        question: item.question,
        passed,
        required: item.required,
        suggestion: passed ? undefined : this.getSuggestion(item),
      };
    });

    const requiredResults = results.filter((r) => r.required);
    const allRequiredPassed = requiredResults.every((r) => r.passed);
    const passRate =
      results.length > 0 ? results.filter((r) => r.passed).length / results.length : 1;

    return {
      checklistId,
      items: results,
      passRate,
      passed: allRequiredPassed,
      evaluatedAt: new Date().toISOString(),
    };
  }

  private evaluateItem(
    evaluator: ChecklistEvaluator,
    content: string,
    context?: Record<string, unknown>,
  ): boolean {
    switch (evaluator.type) {
      case 'regex': {
        const regex = new RegExp(evaluator.pattern, 'im');
        const found = regex.test(content);
        return evaluator.invert ? !found : found;
      }

      case 'keyword_presence': {
        const minMatches = evaluator.minMatches ?? 1;
        const matches = evaluator.keywords.filter((kw) =>
          content.toLowerCase().includes(kw.toLowerCase()),
        );
        return matches.length >= minMatches;
      }

      case 'section_exists': {
        const headingPattern = new RegExp(
          `^#{1,4}\\s+.*${this.escapeRegex(evaluator.heading)}`,
          'im',
        );
        return headingPattern.test(content);
      }

      case 'min_length':
        return content.trim().length >= evaluator.chars;

      case 'custom':
        return evaluator.fn(content, context);

      default:
        return true;
    }
  }

  private getSuggestion(item: ChecklistItem): string {
    switch (item.evaluator.type) {
      case 'section_exists':
        return `Add a section with heading "${item.evaluator.heading}"`;
      case 'keyword_presence':
        return `Include keywords: ${item.evaluator.keywords.join(', ')}`;
      case 'regex':
        return item.evaluator.invert
          ? `Remove content matching pattern: ${item.evaluator.pattern}`
          : `Add content matching pattern: ${item.evaluator.pattern}`;
      case 'min_length':
        return `Content must be at least ${item.evaluator.chars} characters`;
      default:
        return 'Review and address this checklist item';
    }
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

export function createChecklistValidator(): ChecklistValidator {
  return new ChecklistValidator();
}
