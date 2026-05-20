/**
 * Clarify Phase — 结构化澄清协议
 * 通过有限轮次的 Q&A 消除规格中的歧义
 */

import type { WorkflowState } from '../types.js';

export interface ClarifyQuestion {
  id: string;
  question: string;
  category: 'ambiguity' | 'missing_detail' | 'conflict' | 'scope';
  priority: 'critical' | 'high' | 'medium';
  context?: string;
}

export interface ClarifyAnswer {
  questionId: string;
  answer: string;
}

export interface ClarifyRoundResult {
  round: number;
  questions: ClarifyQuestion[];
  answers: ClarifyAnswer[];
  resolved: boolean;
}

export function generateClarifyPrompt(specContent: string, state: WorkflowState): string {
  const round = state.clarifyRounds + 1;
  const parts: string[] = [
    `## Clarification Round ${round}`,
    '',
    'Review the specification below and identify ambiguities or missing details.',
    'Ask up to 3 focused questions. Prioritize critical gaps that would block implementation.',
    '',
    'If the spec is clear enough to proceed, respond with: "No further clarification needed."',
    '',
    '### Current Specification',
    specContent,
    '',
    '### Question Format',
    'For each question:',
    '- State what is unclear or missing',
    '- Explain why it matters for implementation',
    "- Suggest a default if the user doesn't answer",
  ];

  return parts.join('\n');
}

export function parseClarifyQuestions(llmResponse: string): ClarifyQuestion[] {
  const questions: ClarifyQuestion[] = [];
  const lines = llmResponse.split('\n');
  let questionCount = 0;

  for (const line of lines) {
    const match = line.match(/^\d+\.\s+(.+)/);
    if (match) {
      questionCount++;
      questions.push({
        id: `q-${questionCount}`,
        question: match[1].trim(),
        category: 'ambiguity',
        priority: questionCount === 1 ? 'critical' : 'high',
      });
    }
  }

  return questions;
}

export function isResolved(llmResponse: string): boolean {
  const normalized = llmResponse.toLowerCase();
  return (
    normalized.includes('no further clarification') ||
    normalized.includes('clear enough to proceed')
  );
}

export function applyAnswersToSpec(specContent: string, answers: ClarifyAnswer[]): string {
  if (answers.length === 0) return specContent;

  const clarificationSection = [
    '',
    '## Clarifications',
    ...answers.map((a) => `- **${a.questionId}**: ${a.answer}`),
  ].join('\n');

  return `${specContent}\n${clarificationSection}`;
}
