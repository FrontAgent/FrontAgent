/**
 * Specify Phase — 从用户意图生成结构化规格
 */

import type { WorkflowState } from '../types.js';

export interface SpecifyInput {
  userRequest: string;
  existingContext?: string;
}

export interface SpecifyOutput {
  specContent: string;
  suggestedTitle: string;
}

export function generateSpecPrompt(input: SpecifyInput, _state: WorkflowState): string {
  const parts: string[] = [
    '## Specification Phase',
    '',
    'Generate a structured specification for the following request.',
    'The spec MUST include:',
    '- Clear acceptance criteria (prefix with AC-)',
    '- Explicit scope boundaries (what IS and IS NOT included)',
    '- Measurable success conditions',
    '',
    '### User Request',
    input.userRequest,
  ];

  if (input.existingContext) {
    parts.push('', '### Existing Context', input.existingContext);
  }

  parts.push(
    '',
    '### Output Format',
    '```markdown',
    '# [Title]',
    '',
    '## Summary',
    '[1-2 sentence overview]',
    '',
    '## Acceptance Criteria',
    '- [ ] AC-1: ...',
    '- [ ] AC-2: ...',
    '',
    '## Scope',
    '### In Scope',
    '- ...',
    '### Out of Scope',
    '- ...',
    '',
    '## Technical Notes (optional)',
    '```',
  );

  return parts.join('\n');
}

export function extractSpecTitle(specContent: string): string {
  const match = specContent.match(/^#\s+(.+)$/m);
  return match?.[1] ?? 'Untitled Spec';
}
