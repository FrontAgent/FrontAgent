import { existsSync, realpathSync, statSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';

export interface SafePathResult {
  ok: boolean;
  fullPath: string;
  relativePath: string;
  error?: string;
}

const PACKAGE_OR_LOCK_FILES = new Set([
  'package.json',
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'bun.lockb',
]);

function normalizeRelativePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\/+/, '');
}

export function isInsidePath(child: string, parent: string): boolean {
  const rel = relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

export function getRealProjectRoot(projectRoot: string): string {
  return realpathSync(resolve(projectRoot));
}

function findNearestExistingParent(fullPath: string, projectRoot: string): string | undefined {
  let current = dirname(fullPath);
  const root = resolve(projectRoot);

  while (isInsidePath(current, root)) {
    if (existsSync(current)) {
      return current;
    }

    const next = dirname(current);
    if (next === current) break;
    current = next;
  }

  return existsSync(root) ? root : undefined;
}

export function resolveReadPath(filePath: string, projectRoot: string): SafePathResult {
  const realProjectRoot = getRealProjectRoot(projectRoot);
  const fullPath = resolve(realProjectRoot, filePath);

  if (!existsSync(fullPath)) {
    return {
      ok: false,
      fullPath,
      relativePath: normalizeRelativePath(relative(realProjectRoot, fullPath)),
      error: `Path not found: ${filePath}`,
    };
  }

  const realPath = realpathSync(fullPath);
  if (!isInsidePath(realPath, realProjectRoot)) {
    return {
      ok: false,
      fullPath: realPath,
      relativePath: normalizeRelativePath(relative(realProjectRoot, realPath)),
      error: 'Access denied: Path resolves outside project root',
    };
  }

  return {
    ok: true,
    fullPath: realPath,
    relativePath: normalizeRelativePath(relative(realProjectRoot, realPath)),
  };
}

export function resolveWritePath(filePath: string, projectRoot: string): SafePathResult {
  const realProjectRoot = getRealProjectRoot(projectRoot);
  const fullPath = resolve(realProjectRoot, filePath);

  if (!isInsidePath(fullPath, realProjectRoot)) {
    return {
      ok: false,
      fullPath,
      relativePath: normalizeRelativePath(relative(realProjectRoot, fullPath)),
      error: 'Access denied: Path is outside project root',
    };
  }

  if (existsSync(fullPath)) {
    const realPath = realpathSync(fullPath);
    if (!isInsidePath(realPath, realProjectRoot)) {
      return {
        ok: false,
        fullPath: realPath,
        relativePath: normalizeRelativePath(relative(realProjectRoot, realPath)),
        error: 'Access denied: Path resolves outside project root',
      };
    }

    return {
      ok: true,
      fullPath: realPath,
      relativePath: normalizeRelativePath(relative(realProjectRoot, realPath)),
    };
  }

  const nearestParent = findNearestExistingParent(fullPath, realProjectRoot);
  if (!nearestParent) {
    return {
      ok: false,
      fullPath,
      relativePath: normalizeRelativePath(relative(realProjectRoot, fullPath)),
      error: 'Access denied: No existing parent inside project root',
    };
  }

  const realParent = realpathSync(nearestParent);
  if (!isInsidePath(realParent, realProjectRoot)) {
    return {
      ok: false,
      fullPath,
      relativePath: normalizeRelativePath(relative(realProjectRoot, fullPath)),
      error: 'Access denied: Parent path resolves outside project root',
    };
  }

  return {
    ok: true,
    fullPath,
    relativePath: normalizeRelativePath(relative(realProjectRoot, fullPath)),
  };
}

export function isSensitiveWritePath(relativePath: string): boolean {
  const normalized = normalizeRelativePath(relativePath);
  const segments = normalized.split('/');
  const basename = segments[segments.length - 1] ?? normalized;

  if (segments.includes('.git')) return true;
  if (segments[0] === '.frontagent' && segments[1] === 'snapshots') return true;
  if (basename === '.env' || basename.startsWith('.env.')) return true;
  if (/\.(pem|key|p12|pfx)$/i.test(basename)) return true;
  if (/(^|[-_.])(secret|secrets|credential|credentials|private-key|id_rsa|id_ed25519)([-_.]|$)/i.test(basename)) {
    return true;
  }

  return false;
}

export function requiresWriteApproval(relativePath: string): boolean {
  const basename = normalizeRelativePath(relativePath).split('/').pop() ?? relativePath;
  return PACKAGE_OR_LOCK_FILES.has(basename);
}

export function assertWritableByPolicy(input: {
  relativePath: string;
  approved: boolean;
  overwrite?: boolean;
}): string | undefined {
  if (isSensitiveWritePath(input.relativePath)) {
    return `Access denied: Writing sensitive path ${input.relativePath} is blocked`;
  }

  if (input.overwrite && !input.approved) {
    return `Security approval required before overwriting ${input.relativePath}`;
  }

  if (requiresWriteApproval(input.relativePath) && !input.approved) {
    return `Security approval required before modifying dependency file ${input.relativePath}`;
  }

  return undefined;
}

export function isRegularFile(path: string): boolean {
  return statSync(path).isFile();
}

export function isDirectory(path: string): boolean {
  return statSync(path).isDirectory();
}

export function isUnsafeGlobPattern(pattern: string): boolean {
  return pattern.startsWith('/') || pattern.split(/[\\/]+/).includes('..');
}
