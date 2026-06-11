import { describe, expect, it } from 'vitest';
import {
  deriveAllowRule,
  evaluatePermissionRules,
  matchesPermissionRule,
  parsePermissionRule,
} from './permission-rules.js';

describe('parsePermissionRule', () => {
  it('parses a bare tool rule', () => {
    expect(parsePermissionRule('run_command')).toEqual({ toolName: 'run_command' });
  });

  it('parses a tool rule with a pattern', () => {
    expect(parsePermissionRule('run_command(pnpm test:*)')).toEqual({
      toolName: 'run_command',
      pattern: 'pnpm test:*',
    });
  });

  it('rejects empty and malformed rules', () => {
    expect(parsePermissionRule('')).toBeUndefined();
    expect(parsePermissionRule('   ')).toBeUndefined();
    expect(parsePermissionRule('bad rule name')).toBeUndefined();
  });
});

describe('matchesPermissionRule', () => {
  it('matches a bare rule against any args of that tool', () => {
    expect(matchesPermissionRule('run_command', 'run_command', { command: 'ls' })).toBe(true);
    expect(matchesPermissionRule('run_command', 'create_file', { path: 'a.ts' })).toBe(false);
  });

  it('matches wildcard patterns against the primary argument', () => {
    expect(
      matchesPermissionRule('run_command(pnpm test:*)', 'run_command', {
        command: 'pnpm test:unit',
      }),
    ).toBe(true);
    expect(
      matchesPermissionRule('run_command(pnpm test:*)', 'run_command', { command: 'pnpm build' }),
    ).toBe(false);
  });

  it('treats regex metacharacters in patterns literally', () => {
    expect(
      matchesPermissionRule('create_file(src/a+b.ts)', 'create_file', { path: 'src/a+b.ts' }),
    ).toBe(true);
    expect(
      matchesPermissionRule('create_file(src/a+b.ts)', 'create_file', { path: 'src/aab.ts' }),
    ).toBe(false);
  });

  it('does not match patterned rules when the primary argument is missing', () => {
    expect(matchesPermissionRule('run_command(ls*)', 'run_command', {})).toBe(false);
  });
});

describe('evaluatePermissionRules', () => {
  const rules = {
    allow: ['run_command(pnpm test:*)', 'browser_navigate(http://localhost:*)'],
    deny: ['run_command(pnpm test:dangerous)'],
  };

  it('returns undefined when no rules are configured or matched', () => {
    expect(evaluatePermissionRules(undefined, 'run_command', { command: 'ls' })).toBeUndefined();
    expect(evaluatePermissionRules(rules, 'run_command', { command: 'ls' })).toBeUndefined();
  });

  it('deny takes precedence over allow', () => {
    expect(
      evaluatePermissionRules(rules, 'run_command', { command: 'pnpm test:dangerous' }),
    ).toEqual({ outcome: 'deny', rule: 'run_command(pnpm test:dangerous)' });
  });

  it('returns the matching allow rule', () => {
    expect(evaluatePermissionRules(rules, 'run_command', { command: 'pnpm test:unit' })).toEqual({
      outcome: 'allow',
      rule: 'run_command(pnpm test:*)',
    });
  });
});

describe('deriveAllowRule', () => {
  it('derives an exact rule from the primary argument', () => {
    expect(deriveAllowRule('run_command', { command: 'pnpm lint' })).toBe('run_command(pnpm lint)');
    expect(deriveAllowRule('browser_navigate', { url: 'https://example.test' })).toBe(
      'browser_navigate(https://example.test)',
    );
  });

  it('refuses to derive a rule when no primary argument exists', () => {
    // 不能从一次具体审批派生"允许该工具所有调用"的裸规则
    expect(deriveAllowRule('rollback', {})).toBeUndefined();
    expect(deriveAllowRule('custom_tool', { query: 'first' })).toBeUndefined();
  });

  it('escapes literal wildcards so an approval is never widened', () => {
    const rule = deriveAllowRule('run_command', { command: 'echo *' });
    expect(rule).toBe('run_command(echo \\*)');

    // 派生规则只匹配原始调用，不匹配其他命令
    expect(matchesPermissionRule(rule as string, 'run_command', { command: 'echo *' })).toBe(true);
    expect(matchesPermissionRule(rule as string, 'run_command', { command: 'echo secret' })).toBe(
      false,
    );
    expect(
      matchesPermissionRule(rule as string, 'run_command', { command: 'echo anything else' }),
    ).toBe(false);
  });

  it('escapes backslashes so windows-style paths stay literal', () => {
    const rule = deriveAllowRule('create_file', { path: 'src\\*.ts' }) as string;
    expect(matchesPermissionRule(rule, 'create_file', { path: 'src\\*.ts' })).toBe(true);
    expect(matchesPermissionRule(rule, 'create_file', { path: 'src\\evil.ts' })).toBe(false);
  });
});

describe('escaped patterns vs user wildcards', () => {
  it('keeps unescaped * as a wildcard for hand-written rules', () => {
    expect(
      matchesPermissionRule('run_command(pnpm test:*)', 'run_command', {
        command: 'pnpm test:unit',
      }),
    ).toBe(true);
  });

  it('treats \\* as a literal star inside hand-written rules', () => {
    expect(
      matchesPermissionRule('run_command(echo \\*)', 'run_command', { command: 'echo *' }),
    ).toBe(true);
    expect(
      matchesPermissionRule('run_command(echo \\*)', 'run_command', { command: 'echo x' }),
    ).toBe(false);
  });
});
