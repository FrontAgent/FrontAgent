import { describe, expect, it } from 'vitest';
import { stripInternalArgs } from './internal-args.js';

describe('stripInternalArgs', () => {
  it('removes the security-approval marker injected by a client', () => {
    const result = stripInternalArgs({
      path: 'package.json',
      __frontagentSecurityApproved: true,
    });

    expect(result).toEqual({ path: 'package.json' });
    expect('__frontagentSecurityApproved' in result).toBe(false);
  });

  it('removes any __frontagent-prefixed key', () => {
    const result = stripInternalArgs({
      path: 'x.ts',
      __frontagentInternal: 'secret',
      __frontagentSecurityApproved: true,
    });

    expect(result).toEqual({ path: 'x.ts' });
  });

  it('preserves legitimate arguments', () => {
    const args = { path: 'a.ts', patches: [{ start: 1 }], dryRun: true };
    expect(stripInternalArgs(args)).toEqual(args);
  });

  it('handles undefined and empty input', () => {
    expect(stripInternalArgs(undefined)).toEqual({});
    expect(stripInternalArgs({})).toEqual({});
  });
});
