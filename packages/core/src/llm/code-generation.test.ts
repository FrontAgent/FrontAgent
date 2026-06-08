import { describe, expect, it } from 'vitest';
import { parseTypeScriptErrors } from './code-generation.js';

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
