/**
 * Constitution 类型定义
 * 项目宪法：定义 Agent 行为的最高优先级原则
 */

export type PrinciplePriority = 'critical' | 'high' | 'medium';

export interface Principle {
  id: string;
  name: string;
  description: string;
  priority: PrinciplePriority;
  examples?: string[];
}

export interface BehaviorDirective {
  id: string;
  trigger: string;
  action: string;
  rationale?: string;
}

export interface ReviewCriterion {
  id: string;
  name: string;
  question: string;
  failAction: 'block' | 'warn' | 'note';
}

export interface Constitution {
  version: string;
  principles: Principle[];
  behaviors: BehaviorDirective[];
  reviewCriteria?: ReviewCriterion[];
}
