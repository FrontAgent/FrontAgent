/**
 * Constitution 解析器
 * 解析 constitution.yaml 文件为结构化 Constitution 对象
 */

import { existsSync, readFileSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';
import type { BehaviorDirective, Constitution, Principle, ReviewCriterion } from './types.js';

export interface ConstitutionParseResult {
  success: boolean;
  constitution?: Constitution;
  errors?: string[];
}

export class ConstitutionParser {
  parseFile(filePath: string): ConstitutionParseResult {
    if (!existsSync(filePath)) {
      return { success: false, errors: [`Constitution file not found: ${filePath}`] };
    }

    try {
      const content = readFileSync(filePath, 'utf-8');
      return this.parseContent(content);
    } catch (error) {
      return {
        success: false,
        errors: [
          `Failed to read constitution file: ${error instanceof Error ? error.message : String(error)}`,
        ],
      };
    }
  }

  parseContent(content: string): ConstitutionParseResult {
    let raw: unknown;
    try {
      raw = parseYaml(content);
    } catch {
      try {
        raw = JSON.parse(content);
      } catch {
        return { success: false, errors: ['Invalid YAML/JSON format'] };
      }
    }

    if (!raw || typeof raw !== 'object') {
      return { success: false, errors: ['Constitution must be an object'] };
    }

    const obj = raw as Record<string, unknown>;
    const errors: string[] = [];

    const version = typeof obj.version === 'string' ? obj.version : '1.0';

    const principles = this.parsePrinciples(obj.principles, errors);
    const behaviors = this.parseBehaviors(obj.behaviors, errors);
    const reviewCriteria = this.parseReviewCriteria(obj.reviewCriteria ?? obj.review_criteria);

    if (principles.length === 0 && behaviors.length === 0) {
      errors.push('Constitution must define at least one principle or behavior');
    }

    if (errors.length > 0) {
      return { success: false, errors };
    }

    return {
      success: true,
      constitution: { version, principles, behaviors, reviewCriteria },
    };
  }

  private parsePrinciples(raw: unknown, errors: string[]): Principle[] {
    if (!Array.isArray(raw)) return [];

    return raw
      .map((item, idx) => {
        if (!item || typeof item !== 'object') {
          errors.push(`principles[${idx}]: must be an object`);
          return null;
        }
        const p = item as Record<string, unknown>;
        if (!p.name || typeof p.name !== 'string') {
          errors.push(`principles[${idx}]: missing required field "name"`);
          return null;
        }
        if (!p.description || typeof p.description !== 'string') {
          errors.push(`principles[${idx}]: missing required field "description"`);
          return null;
        }
        const priority = this.normalizePriority(p.priority);
        return {
          id: typeof p.id === 'string' ? p.id : `principle-${idx}`,
          name: p.name,
          description: p.description,
          priority,
          ...(Array.isArray(p.examples)
            ? { examples: p.examples.filter((e): e is string => typeof e === 'string') }
            : {}),
        } as Principle;
      })
      .filter((p): p is Principle => p !== null);
  }

  private parseBehaviors(raw: unknown, errors: string[]): BehaviorDirective[] {
    if (!Array.isArray(raw)) return [];

    return raw
      .map((item, idx) => {
        if (!item || typeof item !== 'object') {
          errors.push(`behaviors[${idx}]: must be an object`);
          return null;
        }
        const b = item as Record<string, unknown>;
        if (!b.trigger || typeof b.trigger !== 'string') {
          errors.push(`behaviors[${idx}]: missing required field "trigger"`);
          return null;
        }
        if (!b.action || typeof b.action !== 'string') {
          errors.push(`behaviors[${idx}]: missing required field "action"`);
          return null;
        }
        return {
          id: typeof b.id === 'string' ? b.id : `behavior-${idx}`,
          trigger: b.trigger,
          action: b.action,
          ...(typeof b.rationale === 'string' ? { rationale: b.rationale } : {}),
        } as BehaviorDirective;
      })
      .filter((b): b is BehaviorDirective => b !== null);
  }

  private parseReviewCriteria(raw: unknown): ReviewCriterion[] | undefined {
    if (!Array.isArray(raw)) return undefined;

    const criteria = raw
      .map((item, idx) => {
        if (!item || typeof item !== 'object') return null;
        const c = item as Record<string, unknown>;
        if (!c.question || typeof c.question !== 'string') return null;
        const failAction = c.failAction ?? c.fail_action;
        return {
          id: typeof c.id === 'string' ? c.id : `criterion-${idx}`,
          name: typeof c.name === 'string' ? c.name : `Criterion ${idx + 1}`,
          question: c.question,
          failAction:
            failAction === 'block' || failAction === 'warn' || failAction === 'note'
              ? failAction
              : 'warn',
        } satisfies ReviewCriterion;
      })
      .filter((c): c is ReviewCriterion => c !== null);

    return criteria.length > 0 ? criteria : undefined;
  }

  private normalizePriority(value: unknown): Principle['priority'] {
    if (value === 'critical' || value === 'high' || value === 'medium') return value;
    return 'medium';
  }
}

export function createConstitutionParser(): ConstitutionParser {
  return new ConstitutionParser();
}
