import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, parse, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE_NAME = 'frontagent';
const UNKNOWN_VERSION = 'unknown';

type PackageJson = {
  name?: unknown;
  version?: unknown;
};

export function findFrontAgentPackageVersion(startDir: string): string | undefined {
  let currentDir = resolve(startDir);
  const { root } = parse(currentDir);

  while (true) {
    const packagePath = join(currentDir, 'package.json');

    if (existsSync(packagePath)) {
      try {
        const packageJson = JSON.parse(readFileSync(packagePath, 'utf8')) as PackageJson;
        if (
          packageJson.name === PACKAGE_NAME &&
          typeof packageJson.version === 'string' &&
          packageJson.version.length > 0
        ) {
          return packageJson.version;
        }
      } catch {
        // Keep walking upward; a malformed nested package should not break cheap CLI paths.
      }
    }

    if (currentDir === root) {
      return undefined;
    }

    currentDir = dirname(currentDir);
  }
}

export function getCliVersion(): string {
  return findFrontAgentPackageVersion(dirname(fileURLToPath(import.meta.url))) ?? UNKNOWN_VERSION;
}
