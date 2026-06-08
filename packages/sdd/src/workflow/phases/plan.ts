/**
 * Plan Phase — 注入 spec 上下文的增强计划生成
 */

import type { WorkflowState } from '../types.js';

export interface PlanInput {
  specContent: string;
  techConstraints?: string;
  existingCode?: string;
}

export interface PlanOutput {
  planContent: string;
  estimatedSteps: number;
}

export function generatePlanPrompt(input: PlanInput, _state: WorkflowState): string {
  const parts: string[] = [
    '## Planning Phase',
    '',
    'Create an implementation plan based on the specification below.',
    'The plan MUST:',
    '- Reference specific file paths',
    '- Have no placeholders (TBD/TODO/fill-in-later)',
    '- Break work into atomic steps (each ≤ 5 minutes)',
    '- Cover ALL acceptance criteria from the spec',
    '',
    '### Specification',
    input.specContent,
  ];

  if (input.techConstraints) {
    parts.push('', '### Technical Constraints', input.techConstraints);
  }

  if (input.existingCode) {
    parts.push('', '### Relevant Existing Code', input.existingCode);
  }

  parts.push(
    '',
    '### Output Format',
    'Use numbered steps. Each step should:',
    '- Start with an action verb',
    '- Reference the target file(s)',
    '- Describe the concrete change',
    '- Note dependencies on prior steps with [depends: N]',
  );

  return parts.join('\n');
}

export function extractStepCount(planContent: string): number {
  const stepPattern = /^\d+\.\s/gm;
  const matches = planContent.match(stepPattern);
  return matches?.length ?? 0;
}

export function extractFilePaths(planContent: string): string[] {
  const pathPattern = /(?:src\/|\.\/|\w+\/)\S+\.\w{2,4}/g;
  const matches = planContent.match(pathPattern) ?? [];
  return [...new Set(matches)];
}
