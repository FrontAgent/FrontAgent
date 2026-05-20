import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  assertWritableByPolicy,
  isDirectory,
  isInsidePath,
  isRegularFile,
  isSensitiveWritePath,
  isUnsafeGlobPattern,
  requiresWriteApproval,
  resolveReadPath,
  resolveWritePath,
} from './path-safety.js';

let roots: string[] = [];

function makeRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'path-safety-'));
  roots.push(root);
  return root;
}

afterEach(() => {
  for (const root of roots) {
    rmSync(root, { recursive: true, force: true });
  }
  roots = [];
});

describe('isInsidePath', () => {
  it('returns true for same path', () => {
    expect(isInsidePath('/a/b', '/a/b')).toBe(true);
  });

  it('returns true for child path', () => {
    expect(isInsidePath('/a/b/c', '/a/b')).toBe(true);
  });

  it('returns false for parent path', () => {
    expect(isInsidePath('/a', '/a/b')).toBe(false);
  });

  it('returns false for sibling path', () => {
    expect(isInsidePath('/a/c', '/a/b')).toBe(false);
  });

  it('returns false for sibling-prefix attack', () => {
    expect(isInsidePath('/a/b-sibling/c', '/a/b')).toBe(false);
  });

  it('returns false for .. traversal', () => {
    expect(isInsidePath('/a/b/../c', '/a/b')).toBe(false);
  });
});

describe('resolveReadPath', () => {
  it('resolves a valid file inside project root', () => {
    const root = makeRoot();
    writeFileSync(join(root, 'hello.txt'), 'hi', 'utf-8');

    const result = resolveReadPath('hello.txt', root);
    expect(result.ok).toBe(true);
    expect(result.relativePath).toBe('hello.txt');
  });

  it('resolves nested paths', () => {
    const root = makeRoot();
    mkdirSync(join(root, 'src'));
    writeFileSync(join(root, 'src/index.ts'), '', 'utf-8');

    const result = resolveReadPath('src/index.ts', root);
    expect(result.ok).toBe(true);
    expect(result.relativePath).toBe('src/index.ts');
  });

  it('rejects non-existent paths', () => {
    const root = makeRoot();
    const result = resolveReadPath('missing.txt', root);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not found/i);
  });

  it('rejects symlinks that escape project root', () => {
    const root = makeRoot();
    const outside = mkdtempSync(join(tmpdir(), 'path-safety-outside-'));
    roots.push(outside);
    writeFileSync(join(outside, 'secret.txt'), 'secret', 'utf-8');
    symlinkSync(join(outside, 'secret.txt'), join(root, 'escape.txt'));

    const result = resolveReadPath('escape.txt', root);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/outside project root/i);
  });

  it('rejects ../  traversal attempts', () => {
    const root = makeRoot();
    const parent = resolve(root, '..');
    writeFileSync(join(parent, 'path-safety-target.txt'), 'x', 'utf-8');
    roots.push(join(parent, 'path-safety-target.txt'));

    const result = resolveReadPath('../path-safety-target.txt', root);
    expect(result.ok).toBe(false);
  });
});

describe('resolveWritePath', () => {
  it('resolves a valid existing file', () => {
    const root = makeRoot();
    writeFileSync(join(root, 'file.ts'), '', 'utf-8');

    const result = resolveWritePath('file.ts', root);
    expect(result.ok).toBe(true);
    expect(result.relativePath).toBe('file.ts');
  });

  it('allows writing to non-existent file in existing directory', () => {
    const root = makeRoot();
    mkdirSync(join(root, 'src'));

    const result = resolveWritePath('src/new.ts', root);
    expect(result.ok).toBe(true);
    expect(result.relativePath).toBe('src/new.ts');
  });

  it('allows writing to non-existent nested path if parent exists', () => {
    const root = makeRoot();
    mkdirSync(join(root, 'src'));

    const result = resolveWritePath('src/deep/new.ts', root);
    expect(result.ok).toBe(true);
  });

  it('rejects paths outside project root', () => {
    const root = makeRoot();
    const result = resolveWritePath('../escape.txt', root);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/outside project root/i);
  });

  it('rejects symlink that resolves outside project root', () => {
    const root = makeRoot();
    const outside = mkdtempSync(join(tmpdir(), 'path-safety-outside-'));
    roots.push(outside);
    writeFileSync(join(outside, 'target.txt'), '', 'utf-8');
    symlinkSync(join(outside, 'target.txt'), join(root, 'link.txt'));

    const result = resolveWritePath('link.txt', root);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/outside project root/i);
  });

  it('rejects absolute paths outside root', () => {
    const root = makeRoot();
    const result = resolveWritePath('/tmp/evil.txt', root);
    expect(result.ok).toBe(false);
  });
});

describe('isSensitiveWritePath', () => {
  it('blocks .git paths', () => {
    expect(isSensitiveWritePath('.git/config')).toBe(true);
    expect(isSensitiveWritePath('src/.git/hooks/pre-commit')).toBe(true);
  });

  it('blocks .frontagent/snapshots', () => {
    expect(isSensitiveWritePath('.frontagent/snapshots/snap-1.json')).toBe(true);
  });

  it('allows .frontagent non-snapshot paths', () => {
    expect(isSensitiveWritePath('.frontagent/config.json')).toBe(false);
  });

  it('blocks .env files', () => {
    expect(isSensitiveWritePath('.env')).toBe(true);
    expect(isSensitiveWritePath('.env.local')).toBe(true);
    expect(isSensitiveWritePath('.env.production')).toBe(true);
    expect(isSensitiveWritePath('config/.env')).toBe(true);
  });

  it('blocks key/cert files', () => {
    expect(isSensitiveWritePath('server.pem')).toBe(true);
    expect(isSensitiveWritePath('ssl/cert.key')).toBe(true);
    expect(isSensitiveWritePath('auth.p12')).toBe(true);
    expect(isSensitiveWritePath('store.pfx')).toBe(true);
    expect(isSensitiveWritePath('cert.PEM')).toBe(true);
  });

  it('blocks secret/credential files', () => {
    expect(isSensitiveWritePath('secrets.json')).toBe(true);
    expect(isSensitiveWritePath('credentials.yaml')).toBe(true);
    expect(isSensitiveWritePath('private-key.pem')).toBe(true);
    expect(isSensitiveWritePath('id_rsa')).toBe(true);
    expect(isSensitiveWritePath('id_ed25519')).toBe(true);
    expect(isSensitiveWritePath('.secret')).toBe(true);
  });

  it('allows normal source files', () => {
    expect(isSensitiveWritePath('src/index.ts')).toBe(false);
    expect(isSensitiveWritePath('README.md')).toBe(false);
    expect(isSensitiveWritePath('package.json')).toBe(false);
  });

  it('handles backslash paths', () => {
    expect(isSensitiveWritePath('.git\\config')).toBe(true);
  });
});

describe('requiresWriteApproval', () => {
  it('requires approval for package.json', () => {
    expect(requiresWriteApproval('package.json')).toBe(true);
  });

  it('requires approval for lock files', () => {
    expect(requiresWriteApproval('package-lock.json')).toBe(true);
    expect(requiresWriteApproval('pnpm-lock.yaml')).toBe(true);
    expect(requiresWriteApproval('yarn.lock')).toBe(true);
    expect(requiresWriteApproval('bun.lockb')).toBe(true);
  });

  it('requires approval for nested package.json', () => {
    expect(requiresWriteApproval('packages/core/package.json')).toBe(true);
  });

  it('does not require approval for normal files', () => {
    expect(requiresWriteApproval('src/index.ts')).toBe(false);
    expect(requiresWriteApproval('tsconfig.json')).toBe(false);
  });
});

describe('assertWritableByPolicy', () => {
  it('blocks sensitive paths regardless of approval', () => {
    const err = assertWritableByPolicy({ relativePath: '.env', approved: true });
    expect(err).toMatch(/sensitive path/i);
  });

  it('blocks unapproved overwrites', () => {
    const err = assertWritableByPolicy({
      relativePath: 'src/app.ts',
      approved: false,
      overwrite: true,
    });
    expect(err).toMatch(/approval required/i);
  });

  it('allows approved overwrites', () => {
    const err = assertWritableByPolicy({
      relativePath: 'src/app.ts',
      approved: true,
      overwrite: true,
    });
    expect(err).toBeUndefined();
  });

  it('blocks unapproved dependency file writes', () => {
    const err = assertWritableByPolicy({ relativePath: 'package.json', approved: false });
    expect(err).toMatch(/dependency file/i);
  });

  it('allows approved dependency file writes', () => {
    const err = assertWritableByPolicy({ relativePath: 'package.json', approved: true });
    expect(err).toBeUndefined();
  });

  it('allows normal file writes without approval', () => {
    const err = assertWritableByPolicy({ relativePath: 'src/utils.ts', approved: false });
    expect(err).toBeUndefined();
  });
});

describe('isUnsafeGlobPattern', () => {
  it('rejects absolute glob patterns', () => {
    expect(isUnsafeGlobPattern('/etc/**')).toBe(true);
    expect(isUnsafeGlobPattern('/home/user/*')).toBe(true);
  });

  it('rejects patterns with .. traversal', () => {
    expect(isUnsafeGlobPattern('../**')).toBe(true);
    expect(isUnsafeGlobPattern('src/../../etc/*')).toBe(true);
  });

  it('allows safe relative patterns', () => {
    expect(isUnsafeGlobPattern('src/**/*.ts')).toBe(false);
    expect(isUnsafeGlobPattern('**/*.md')).toBe(false);
    expect(isUnsafeGlobPattern('*.json')).toBe(false);
  });
});

describe('isRegularFile', () => {
  it('returns true for regular files', () => {
    const root = makeRoot();
    writeFileSync(join(root, 'file.txt'), '', 'utf-8');
    expect(isRegularFile(join(root, 'file.txt'))).toBe(true);
  });

  it('returns false for directories', () => {
    const root = makeRoot();
    expect(isRegularFile(root)).toBe(false);
  });

  it('returns false for non-existent paths', () => {
    expect(isRegularFile('/tmp/path-safety-nonexistent-xyz')).toBe(false);
  });
});

describe('isDirectory', () => {
  it('returns true for directories', () => {
    const root = makeRoot();
    expect(isDirectory(root)).toBe(true);
  });

  it('returns false for regular files', () => {
    const root = makeRoot();
    writeFileSync(join(root, 'file.txt'), '', 'utf-8');
    expect(isDirectory(join(root, 'file.txt'))).toBe(false);
  });

  it('returns false for non-existent paths', () => {
    expect(isDirectory('/tmp/path-safety-nonexistent-xyz')).toBe(false);
  });
});
