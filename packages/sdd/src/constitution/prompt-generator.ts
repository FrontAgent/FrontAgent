/**
 * Constitution Prompt 生成器
 * 将 Constitution 转换为 LLM System Prompt 中的最高优先级原则段落
 */

import type { Constitution } from './types.js';

export interface ConstitutionPromptOptions {
  language?: 'en' | 'zh';
  compact?: boolean;
}

export class ConstitutionPromptGenerator {
  private constitution: Constitution;
  private options: Required<ConstitutionPromptOptions>;

  constructor(constitution: Constitution, options: ConstitutionPromptOptions = {}) {
    this.constitution = constitution;
    this.options = {
      language: options.language ?? 'zh',
      compact: options.compact ?? false,
    };
  }

  generate(): string {
    if (this.options.compact) {
      return this.generateCompact();
    }

    const isZh = this.options.language === 'zh';
    const sections: string[] = [];

    sections.push(isZh
      ? '## 🏛️ 项目宪法（最高优先级原则）'
      : '## 🏛️ Project Constitution (Highest Priority Principles)');

    sections.push(isZh
      ? '以下原则具有最高优先级，当与其他约束冲突时，以宪法为准：'
      : 'The following principles have the highest priority. When conflicting with other constraints, the constitution takes precedence:');

    // Principles grouped by priority
    const critical = this.constitution.principles.filter(p => p.priority === 'critical');
    const high = this.constitution.principles.filter(p => p.priority === 'high');
    const medium = this.constitution.principles.filter(p => p.priority === 'medium');

    if (critical.length > 0) {
      sections.push(this.renderPrincipleGroup(critical, isZh ? '🚨 关键原则' : '🚨 Critical'));
    }
    if (high.length > 0) {
      sections.push(this.renderPrincipleGroup(high, isZh ? '⚠️ 高优先级' : '⚠️ High Priority'));
    }
    if (medium.length > 0) {
      sections.push(this.renderPrincipleGroup(medium, isZh ? '📌 一般原则' : '📌 General'));
    }

    // Behavior directives
    if (this.constitution.behaviors.length > 0) {
      sections.push(this.renderBehaviors(isZh));
    }

    // Review criteria
    if (this.constitution.reviewCriteria && this.constitution.reviewCriteria.length > 0) {
      sections.push(this.renderReviewCriteria(isZh));
    }

    return sections.join('\n\n');
  }

  generateCompact(): string {
    const principles = this.constitution.principles
      .sort((a, b) => this.priorityWeight(b.priority) - this.priorityWeight(a.priority))
      .slice(0, 5)
      .map(p => `- [${p.priority.toUpperCase()}] ${p.name}: ${p.description}`)
      .join('\n');

    return `## Constitution\n${principles}`;
  }

  private renderPrincipleGroup(principles: Constitution['principles'], heading: string): string {
    const items = principles.map(p => {
      let text = `- **${p.name}**: ${p.description}`;
      if (p.examples && p.examples.length > 0) {
        text += `\n  ${p.examples.map(e => `  - ${e}`).join('\n')}`;
      }
      return text;
    });
    return `### ${heading}\n${items.join('\n')}`;
  }

  private renderBehaviors(isZh: boolean): string {
    const heading = isZh ? '### 行为指令' : '### Behavior Directives';
    const items = this.constitution.behaviors.map(b => {
      const rationale = b.rationale ? ` (${b.rationale})` : '';
      return isZh
        ? `- **当** ${b.trigger} **→** ${b.action}${rationale}`
        : `- **When** ${b.trigger} **→** ${b.action}${rationale}`;
    });
    return `${heading}\n${items.join('\n')}`;
  }

  private renderReviewCriteria(isZh: boolean): string {
    const heading = isZh ? '### 审查标准' : '### Review Criteria';
    const intro = isZh
      ? '完成任务前，必须通过以下审查：'
      : 'Before marking work as complete, the following must be satisfied:';
    const items = this.constitution.reviewCriteria!.map(c => {
      const icon = c.failAction === 'block' ? '🚫' : c.failAction === 'warn' ? '⚠️' : 'ℹ️';
      return `- ${icon} ${c.question}`;
    });
    return `${heading}\n${intro}\n${items.join('\n')}`;
  }

  private priorityWeight(priority: string): number {
    switch (priority) {
      case 'critical': return 3;
      case 'high': return 2;
      case 'medium': return 1;
      default: return 0;
    }
  }
}

export function createConstitutionPromptGenerator(
  constitution: Constitution,
  options?: ConstitutionPromptOptions
): ConstitutionPromptGenerator {
  return new ConstitutionPromptGenerator(constitution, options);
}
