import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { findFrontAgentPackageVersion } from './version.js';

const tempRoots: string[] = [];

function createTempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'frontagent-version-'));
  tempRoots.push(root);
  return root;
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe('CLI version discovery', () => {
  it('uses the root frontagent package version instead of a nested workspace package', () => {
    const root = createTempRoot();
    const sourceDir = join(root, 'apps/cli/src');

    mkdirSync(sourceDir, { recursive: true });
    writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'frontagent', version: '9.9.9' }));
    writeFileSync(
      join(root, 'apps/cli/package.json'),
      JSON.stringify({ name: '@frontagent/cli', version: '0.1.0' }),
    );

    expect(findFrontAgentPackageVersion(sourceDir)).toBe('9.9.9');
  });

  it('returns undefined when no frontagent package is found', () => {
    const root = createTempRoot();
    const sourceDir = join(root, 'apps/cli/src');

    mkdirSync(sourceDir, { recursive: true });
    writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'other', version: '1.0.0' }));

    expect(findFrontAgentPackageVersion(sourceDir)).toBeUndefined();
  });
});
