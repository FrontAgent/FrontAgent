import type { SDDConfig } from '@frontagent/shared';
import { describe, expect, it } from 'vitest';
import type { ProjectFactsSnapshot } from '../types.js';
import { buildCodeQualityLlmReviewPrompt } from './code-quality-prompt.js';

describe('buildCodeQualityLlmReviewPrompt', () => {
  it('builds the existing review prompt while limiting and truncating files', () => {
    const result = buildCodeQualityLlmReviewPrompt(
      {
        taskId: 'task-123',
        phase: 'implement',
        files: [
          { path: 'src/a.ts', content: '1234567890' },
          { path: 'src/b.ts', content: 'short' },
          { path: 'src/c.ts', content: 'excluded' },
        ],
      },
      { maxFilesForLLM: 2, maxCharsPerFileForLLM: 8 },
    );

    expect(result.system).toBe(
      [
        'You are a strict code quality review sub-agent.',
        'Evaluate generated code against SDD constraints and maintainability.',
        'Output only actionable issues.',
        'Set severity=error only for clear correctness or hard-constraint violations.',
      ].join(' '),
    );
    expect(result.userPrompt).toContain('Task ID: task-123');
    expect(result.userPrompt).toContain('Phase: implement');
    expect(result.userPrompt).toContain('No SDD config provided.');
    expect(result.userPrompt).toContain('No shared facts provided.');
    expect(result.userPrompt).toContain('Return concrete issues with filePath/line/rule/message.');

    const filesJson = extractFilesJson(result.userPrompt);
    expect(JSON.parse(filesJson)).toEqual([
      { path: 'src/a.ts', content: '12345678\n/* truncated */' },
      { path: 'src/b.ts', content: 'short' },
    ]);
    expect(result.userPrompt).not.toContain('src/c.ts');
  });

  it('summarizes SDD constraints and shared project facts with existing limits', () => {
    const result = buildCodeQualityLlmReviewPrompt(
      {
        taskId: 'task-456',
        phase: 'review',
        files: [{ path: 'src/app.ts', content: 'export const app = true;' }],
        sddConfig: makeSddConfig(),
        sharedFacts: makeSharedFacts(),
      },
      { maxFilesForLLM: 6, maxCharsPerFileForLLM: 12000 },
    );

    expect(result.userPrompt).toContain('maxFileLines=300');
    expect(result.userPrompt).toContain('maxFunctionLines=40');
    expect(result.userPrompt).toContain('maxParameters=3');
    expect(result.userPrompt).toContain('forbiddenPatterns=console\\.log, debugger');
    expect(result.userPrompt).toContain('forbiddenPackages=left-pad, lodash');

    expect(result.userPrompt).toContain('revision=7');
    expect(result.userPrompt).toContain('existingFiles(21)=file-1.ts');
    expect(result.userPrompt).toContain('file-20.ts');
    expect(result.userPrompt).not.toContain('file-21.ts');
    expect(result.userPrompt).toContain('installedPackages(31)=pkg-1');
    expect(result.userPrompt).toContain('pkg-30');
    expect(result.userPrompt).not.toContain('pkg-31');
    expect(result.userPrompt).toContain('missingPackages(21)=missing-1');
    expect(result.userPrompt).toContain('missing-20');
    expect(result.userPrompt).not.toContain('missing-21');
    expect(result.userPrompt).toContain('moduleCount=2');
    expect(result.userPrompt).toContain(
      'recentErrors=[runtime] error-2 | [runtime] error-3 | [runtime] error-4 | [runtime] error-5 | [runtime] error-6',
    );
    expect(result.userPrompt).not.toContain('error-1');
  });
});

function extractFilesJson(userPrompt: string): string {
  const start = userPrompt.indexOf('Files to review:\n');
  const end = userPrompt.indexOf('\n\nReturn concrete issues', start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return userPrompt.slice(start + 'Files to review:\n'.length, end);
}

function makeSddConfig(): SDDConfig {
  return {
    version: '1',
    project: { name: 'demo', type: 'web' },
    techStack: {
      framework: 'react',
      version: '19',
      language: 'typescript',
      forbiddenPackages: ['left-pad', 'lodash'],
    },
    directoryStructure: {},
    moduleBoundaries: [],
    namingConventions: {
      components: 'PascalCase',
      hooks: 'useCamelCase',
      utils: 'camelCase',
      constants: 'SCREAMING_SNAKE_CASE',
      types: 'PascalCase',
    },
    codeQuality: {
      maxFileLines: 300,
      maxFunctionLines: 40,
      maxParameters: 3,
      requireJsdoc: false,
      forbiddenPatterns: ['console\\.log', 'debugger'],
    },
    modificationRules: {
      protectedFiles: [],
      protectedDirectories: [],
      requireApproval: [],
    },
  };
}

function makeSharedFacts(): ProjectFactsSnapshot {
  return {
    revision: 7,
    filesystem: {
      existingFiles: Array.from({ length: 21 }, (_, index) => `file-${index + 1}.ts`),
      existingDirectories: [],
      nonExistentPaths: [],
      directoryContents: {},
    },
    dependencies: {
      installedPackages: Array.from({ length: 31 }, (_, index) => `pkg-${index + 1}`),
      missingPackages: Array.from({ length: 21 }, (_, index) => `missing-${index + 1}`),
    },
    project: {
      devServerRunning: false,
    },
    moduleDependencyGraph: {
      modules: {
        'src/a.ts': {
          path: 'src/a.ts',
          imports: [],
          exports: [],
          lastModified: 1,
        },
        'src/b.ts': {
          path: 'src/b.ts',
          imports: [],
          exports: [],
          lastModified: 1,
        },
      },
      dependencies: {},
      reverseDependencies: {},
    },
    errors: Array.from({ length: 6 }, (_, index) => ({
      stepId: `step-${index + 1}`,
      type: 'runtime',
      message: `error-${index + 1}`,
      timestamp: index + 1,
    })),
  };
}
