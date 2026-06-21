import type { SDDConfig } from '@frontagent/shared';
import type { ProjectFactsSnapshot } from '../types.js';
import type { CodeQualityReviewFile } from './code-quality-subagent.js';

export interface CodeQualityPromptRequest {
  taskId: string;
  phase: string;
  files: CodeQualityReviewFile[];
  sddConfig?: SDDConfig;
  sharedFacts?: ProjectFactsSnapshot;
}

export interface CodeQualityPromptOptions {
  maxFilesForLLM: number;
  maxCharsPerFileForLLM: number;
}

export interface CodeQualityLlmReviewPrompt {
  system: string;
  userPrompt: string;
}

export function buildCodeQualityLlmReviewPrompt(
  payload: CodeQualityPromptRequest,
  options: CodeQualityPromptOptions,
): CodeQualityLlmReviewPrompt {
  const filesForLLM = payload.files.slice(0, options.maxFilesForLLM).map((file) => ({
    path: file.path,
    content: truncateFileContent(file.content, options.maxCharsPerFileForLLM),
  }));

  const userPrompt = [
    `Task ID: ${payload.taskId}`,
    `Phase: ${payload.phase}`,
    '',
    'SDD constraints summary:',
    buildSddSummary(payload.sddConfig),
    '',
    'Shared project facts snapshot:',
    summarizeSharedFacts(payload.sharedFacts),
    '',
    'Files to review:',
    JSON.stringify(filesForLLM, null, 2),
    '',
    'Return concrete issues with filePath/line/rule/message.',
  ].join('\n');

  return {
    system: [
      'You are a strict code quality review sub-agent.',
      'Evaluate generated code against SDD constraints, maintainability, and security.',
      'Flag common web security vulnerabilities: XSS (unsanitized data flowing into innerHTML/dangerouslySetInnerHTML), command or SQL injection, secrets or API keys hardcoded into client code, and unsafe eval/dynamic code execution or unvalidated URL/redirect handling. Report each with rule "security/<kind>" and an appropriate severity.',
      'Output only actionable issues.',
      'Set severity=error only for clear correctness, hard-constraint, or clear security violations.',
    ].join(' '),
    userPrompt,
  };
}

function buildSddSummary(sddConfig?: SDDConfig): string {
  if (!sddConfig) {
    return 'No SDD config provided.';
  }

  return [
    `maxFileLines=${sddConfig.codeQuality.maxFileLines}`,
    `maxFunctionLines=${sddConfig.codeQuality.maxFunctionLines}`,
    `maxParameters=${sddConfig.codeQuality.maxParameters}`,
    `forbiddenPatterns=${sddConfig.codeQuality.forbiddenPatterns.join(', ') || '(none)'}`,
    `forbiddenPackages=${sddConfig.techStack.forbiddenPackages.join(', ') || '(none)'}`,
  ].join('\n');
}

function summarizeSharedFacts(sharedFacts?: ProjectFactsSnapshot): string {
  if (!sharedFacts) {
    return 'No shared facts provided.';
  }

  const existingFiles = sharedFacts.filesystem.existingFiles.slice(0, 20);
  const missingPackages = sharedFacts.dependencies.missingPackages.slice(0, 20);
  const installedPackages = sharedFacts.dependencies.installedPackages.slice(0, 30);
  const recentErrors = sharedFacts.errors.slice(-5);

  return [
    `revision=${sharedFacts.revision}`,
    `existingFiles(${sharedFacts.filesystem.existingFiles.length})=${existingFiles.join(', ') || '(none)'}`,
    `installedPackages(${sharedFacts.dependencies.installedPackages.length})=${installedPackages.join(', ') || '(none)'}`,
    `missingPackages(${sharedFacts.dependencies.missingPackages.length})=${missingPackages.join(', ') || '(none)'}`,
    `moduleCount=${Object.keys(sharedFacts.moduleDependencyGraph.modules).length}`,
    `recentErrors=${recentErrors.map((err) => `[${err.type}] ${err.message}`).join(' | ') || '(none)'}`,
  ].join('\n');
}

function truncateFileContent(content: string, maxCharsPerFileForLLM: number): string {
  if (content.length <= maxCharsPerFileForLLM) {
    return content;
  }
  return `${content.slice(0, maxCharsPerFileForLLM)}\n/* truncated */`;
}
