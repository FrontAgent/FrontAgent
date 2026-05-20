/**
 * 跨产物一致性分析器
 * 验证 spec ↔ plan ↔ tasks 之间的一致性
 * 借鉴 Spec Kit: cross-artifact consistency & coverage analysis
 */

export interface ConsistencyCheckInput {
  specContent?: string;
  planContent?: string;
  tasksContent?: string;
}

export interface ConsistencyIssue {
  type: 'uncovered_requirement' | 'orphan_task' | 'missing_artifact' | 'contradiction';
  severity: 'error' | 'warning';
  message: string;
  source: string;
  target?: string;
}

export interface ConsistencyResult {
  consistent: boolean;
  issues: ConsistencyIssue[];
  coverage: {
    specRequirements: number;
    coveredByPlan: number;
    coveredByTasks: number;
    ratio: number;
  };
}

export class ConsistencyAnalyzer {
  analyze(input: ConsistencyCheckInput): ConsistencyResult {
    const issues: ConsistencyIssue[] = [];

    // Check for missing artifacts
    if (!input.specContent && (input.planContent || input.tasksContent)) {
      issues.push({
        type: 'missing_artifact',
        severity: 'warning',
        message: 'Plan/tasks exist without a spec — requirements traceability is lost',
        source: 'spec',
      });
    }

    if (input.specContent && !input.planContent && input.tasksContent) {
      issues.push({
        type: 'missing_artifact',
        severity: 'warning',
        message: 'Tasks exist without a plan — implementation approach is undocumented',
        source: 'plan',
      });
    }

    // Extract requirements from spec
    const requirements = input.specContent
      ? this.extractRequirements(input.specContent)
      : [];

    // Extract plan coverage
    const planCoverage = input.planContent
      ? this.extractCoveredTopics(input.planContent)
      : [];

    // Extract task coverage
    const taskCoverage = input.tasksContent
      ? this.extractCoveredTopics(input.tasksContent)
      : [];

    // Check for uncovered requirements
    let coveredByPlan = 0;
    let coveredByTasks = 0;

    for (const req of requirements) {
      const inPlan = planCoverage.some(topic => this.topicCovers(topic, req));
      const inTasks = taskCoverage.some(topic => this.topicCovers(topic, req));

      if (inPlan) coveredByPlan++;
      if (inTasks) coveredByTasks++;

      if (!inPlan && !inTasks && input.planContent) {
        issues.push({
          type: 'uncovered_requirement',
          severity: 'warning',
          message: `Requirement "${req}" may not be covered by plan or tasks`,
          source: 'spec',
          target: 'plan',
        });
      }
    }

    const ratio = requirements.length > 0
      ? Math.max(coveredByPlan, coveredByTasks) / requirements.length
      : 1;

    return {
      consistent: issues.filter(i => i.severity === 'error').length === 0,
      issues,
      coverage: {
        specRequirements: requirements.length,
        coveredByPlan,
        coveredByTasks,
        ratio,
      },
    };
  }

  private extractRequirements(specContent: string): string[] {
    const requirements: string[] = [];
    const lines = specContent.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      // Match common requirement patterns
      if (/^[-*]\s+\[[ x]\]/.test(trimmed)) {
        requirements.push(trimmed.replace(/^[-*]\s+\[[ x]\]\s*/, ''));
      } else if (/^[-*]\s+(MUST|SHALL|SHOULD|REQUIRED):/i.test(trimmed)) {
        requirements.push(trimmed.replace(/^[-*]\s+/, ''));
      } else if (/^(AC|REQ|CR)-?\d+/i.test(trimmed)) {
        requirements.push(trimmed);
      }
    }

    return requirements;
  }

  private extractCoveredTopics(content: string): string[] {
    const topics: string[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      // Headers and list items are topics
      if (/^#{1,4}\s+/.test(trimmed)) {
        topics.push(trimmed.replace(/^#+\s+/, ''));
      } else if (/^[-*]\s+/.test(trimmed) && trimmed.length > 10) {
        topics.push(trimmed.replace(/^[-*]\s+/, ''));
      }
    }

    return topics;
  }

  private topicCovers(topic: string, requirement: string): boolean {
    const topicWords = this.extractKeywords(topic);
    const reqWords = this.extractKeywords(requirement);

    if (reqWords.length === 0) return false;

    const overlap = reqWords.filter(w => topicWords.includes(w));
    return overlap.length / reqWords.length >= 0.4;
  }

  private extractKeywords(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9一-鿿\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2);
  }
}

export function createConsistencyAnalyzer(): ConsistencyAnalyzer {
  return new ConsistencyAnalyzer();
}
