import { describe, expect, it } from 'vitest';
import {
  generateCodeForFile,
  generateModifiedCode,
  parseTypeScriptErrors,
} from './code-generation.js';
import { EXTERNAL_KNOWLEDGE_PROTOCOL, SECURITY_DISCIPLINE } from './prompts.js';

describe('parseTypeScriptErrors', () => {
  it('parses standard tsc error format (parentheses)', () => {
    const steps = [
      {
        error: 'src/app.tsx(10,5): error TS2322: Type string is not assignable to type number',
        params: { command: 'npx tsc --noEmit' },
      },
    ];
    const result = parseTypeScriptErrors(steps);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      file: 'src/app.tsx',
      line: 10,
      column: 5,
      errorCode: 'TS2322',
      message: 'Type string is not assignable to type number',
      rawError: 'src/app.tsx(10,5): error TS2322: Type string is not assignable to type number',
    });
  });

  it('parses alternative tsc error format (colons)', () => {
    const steps = [
      {
        error: 'src/utils.ts:25:3 - error TS7006: Parameter x implicitly has an any type',
        params: { command: 'npm run typecheck' },
      },
    ];
    const result = parseTypeScriptErrors(steps);
    expect(result).toHaveLength(1);
    expect(result[0].file).toBe('src/utils.ts');
    expect(result[0].line).toBe(25);
    expect(result[0].column).toBe(3);
    expect(result[0].errorCode).toBe('TS7006');
  });

  it('parses multiple errors from single step', () => {
    const steps = [
      {
        error: [
          'src/a.ts(1,1): error TS1001: first error',
          'src/b.tsx(2,3): error TS1002: second error',
        ].join('\n'),
        params: { command: 'tsc' },
      },
    ];
    const result = parseTypeScriptErrors(steps);
    expect(result).toHaveLength(2);
    expect(result[0].file).toBe('src/a.ts');
    expect(result[1].file).toBe('src/b.tsx');
  });

  it('skips non-tsc commands', () => {
    const steps = [
      {
        error: 'src/app.tsx(10,5): error TS2322: some error',
        params: { command: 'eslint .' },
      },
    ];
    expect(parseTypeScriptErrors(steps)).toEqual([]);
  });

  it('returns empty array for no errors', () => {
    const steps = [
      {
        error: 'Compilation successful',
        params: { command: 'tsc --noEmit' },
      },
    ];
    expect(parseTypeScriptErrors(steps)).toEqual([]);
  });

  it('returns empty array for empty input', () => {
    expect(parseTypeScriptErrors([])).toEqual([]);
  });

  it('handles steps with typecheck command', () => {
    const steps = [
      {
        error: 'src/index.ts(1,1): error TS2304: Cannot find name foo',
        params: { command: 'pnpm typecheck' },
      },
    ];
    expect(parseTypeScriptErrors(steps)).toHaveLength(1);
  });
});

// The two system prompts below are constructed as local `system` strings inside the
// generate* functions and never returned. These tests reveal them by capturing the
// `system` argument passed to the mocked `generateText` dependency, then asserting the
// external-knowledge discipline is present, mirroring how iteration 17 covered the
// planner prompts for the same protocol.
describe('code-generation system prompts', () => {
  const PROTOCOL_KEY_PHRASES = [
    '不熟悉',
    '版本特定',
    '最近才出现',
    'web_fetch',
    '权威来源',
    '无需 web_fetch',
    '已经熟知且稳定',
  ];

  // Security-engineering discipline (Issue #365): the codegen prompts must also
  // carry the SECURITY_DISCIPLINE so generated/modified frontend code avoids the
  // common vulnerability classes, plus the reverse constraint that guards against
  // over-engineering security for trivial UI.
  const SECURITY_KEY_PHRASES = [
    'XSS',
    'dangerouslySetInnerHTML',
    '注入',
    '密钥',
    'eval',
    '立即修正',
    '与应用面相称',
  ];

  function makeDeps(captureSystem: { value?: string }) {
    return {
      debugLog: () => {},
      debugWarn: () => {},
      debugError: () => {},
      generateText: async (options: { system?: string }) => {
        captureSystem.value = options.system;
        return 'export const placeholder = 1;';
      },
      // generateObject is unused by generateCodeForFile / generateModifiedCode.
      generateObject: async () => {
        throw new Error('generateObject should not be called here');
      },
    };
  }

  it('generateCodeForFile injects EXTERNAL_KNOWLEDGE_PROTOCOL into its system prompt', async () => {
    const captured: { value?: string } = {};
    await generateCodeForFile(
      {
        task: 'add a chart',
        filePath: 'src/chart.tsx',
        codeDescription: 'render a bar chart',
        context: '',
        language: 'typescript',
      },
      makeDeps(captured),
    );

    const system = captured.value ?? '';
    expect(system).toContain(EXTERNAL_KNOWLEDGE_PROTOCOL);
    for (const phrase of PROTOCOL_KEY_PHRASES) {
      expect(system).toContain(phrase);
    }
  });

  it('generateModifiedCode injects EXTERNAL_KNOWLEDGE_PROTOCOL into its system prompt', async () => {
    const captured: { value?: string } = {};
    await generateModifiedCode(
      {
        originalCode: 'export const a = 1;',
        changeDescription: 'rename to b',
        filePath: 'src/util.ts',
        language: 'typescript',
      },
      makeDeps(captured),
    );

    const system = captured.value ?? '';
    expect(system).toContain(EXTERNAL_KNOWLEDGE_PROTOCOL);
    for (const phrase of PROTOCOL_KEY_PHRASES) {
      expect(system).toContain(phrase);
    }
  });

  it('generateCodeForFile injects SECURITY_DISCIPLINE into its system prompt', async () => {
    const captured: { value?: string } = {};
    await generateCodeForFile(
      {
        task: 'add a comment box',
        filePath: 'src/Comments.tsx',
        codeDescription: 'render user-submitted comments',
        context: '',
        language: 'typescript',
      },
      makeDeps(captured),
    );

    const system = captured.value ?? '';
    expect(system).toContain(SECURITY_DISCIPLINE);
    for (const phrase of SECURITY_KEY_PHRASES) {
      expect(system).toContain(phrase);
    }
  });

  it('generateModifiedCode injects SECURITY_DISCIPLINE into its system prompt', async () => {
    const captured: { value?: string } = {};
    await generateModifiedCode(
      {
        originalCode: 'export const a = 1;',
        changeDescription: 'render an external url',
        filePath: 'src/util.ts',
        language: 'typescript',
      },
      makeDeps(captured),
    );

    const system = captured.value ?? '';
    expect(system).toContain(SECURITY_DISCIPLINE);
    for (const phrase of SECURITY_KEY_PHRASES) {
      expect(system).toContain(phrase);
    }
  });
});
