import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { checkFileExistence } from './checks/file-existence.js';
import { checkSyntaxValidity } from './checks/syntax-validity.js';
import { checkAllImports, extractImports } from './checks/import-validity.js';
import { HallucinationGuard } from './guard.js';

const TEST_ROOT = join(tmpdir(), 'frontagent-guard-test-' + Date.now());

beforeAll(() => {
  mkdirSync(TEST_ROOT, { recursive: true });
  writeFileSync(join(TEST_ROOT, 'existing.ts'), 'export const x = 1;\n');
  mkdirSync(join(TEST_ROOT, 'src'), { recursive: true });
  writeFileSync(join(TEST_ROOT, 'src', 'utils.ts'), 'export function add(a: number, b: number) { return a + b; }\n');
  writeFileSync(join(TEST_ROOT, 'package.json'), JSON.stringify({ dependencies: { zod: '^3.0.0' } }));
});

afterAll(() => {
  rmSync(TEST_ROOT, { recursive: true, force: true });
});

describe('checkFileExistence', () => {
  it('passes when file exists and shouldExist is true', async () => {
    const result = await checkFileExistence({
      path: 'existing.ts',
      projectRoot: TEST_ROOT,
      shouldExist: true,
    });
    expect(result.pass).toBe(true);
    expect(result.type).toBe('file_existence');
  });

  it('fails when file does not exist and shouldExist is true', async () => {
    const result = await checkFileExistence({
      path: 'nonexistent.ts',
      projectRoot: TEST_ROOT,
      shouldExist: true,
    });
    expect(result.pass).toBe(false);
    expect(result.severity).toBe('block');
    expect(result.message).toContain('does not exist');
  });

  it('warns when file exists and shouldExist is false', async () => {
    const result = await checkFileExistence({
      path: 'existing.ts',
      projectRoot: TEST_ROOT,
      shouldExist: false,
    });
    expect(result.pass).toBe(false);
    expect(result.severity).toBe('warn');
  });

  it('blocks path traversal outside project root', async () => {
    const result = await checkFileExistence({
      path: '../../etc/passwd',
      projectRoot: TEST_ROOT,
      shouldExist: true,
    });
    expect(result.pass).toBe(false);
    expect(result.severity).toBe('block');
    expect(result.message).toContain('outside project root');
  });
});

describe('checkSyntaxValidity', () => {
  it('passes valid TypeScript code', async () => {
    const result = await checkSyntaxValidity({
      code: 'const x: number = 1;\nfunction add(a: number, b: number) { return a + b; }',
      language: 'typescript',
    });
    expect(result.pass).toBe(true);
  });

  it('detects unmatched brackets', async () => {
    const result = await checkSyntaxValidity({
      code: 'function foo() {\n  if (true) {\n    return 1;\n  }\n',
      language: 'typescript',
    });
    expect(result.pass).toBe(false);
    expect(result.severity).toBe('block');
  });

  it('passes valid JSON', async () => {
    const result = await checkSyntaxValidity({
      code: '{"name": "test", "version": "1.0.0"}',
      language: 'json',
    });
    expect(result.pass).toBe(true);
  });

  it('detects invalid JSON', async () => {
    const result = await checkSyntaxValidity({
      code: '{"name": "test",}',
      language: 'json',
    });
    expect(result.pass).toBe(false);
    expect(result.severity).toBe('block');
  });
});

describe('extractImports', () => {
  it('extracts ES6 imports', () => {
    const code = `
import { foo } from './foo.js';
import bar from 'bar';
import type { Baz } from '@scope/baz';
`;
    const imports = extractImports(code);
    expect(imports).toContain('./foo.js');
    expect(imports).toContain('bar');
    expect(imports).toContain('@scope/baz');
  });

  it('extracts dynamic imports', () => {
    const code = `const mod = await import('./dynamic.js');`;
    const imports = extractImports(code);
    expect(imports).toContain('./dynamic.js');
  });

  it('extracts require calls', () => {
    const code = `const fs = require('node:fs');`;
    const imports = extractImports(code);
    expect(imports).toContain('node:fs');
  });

  it('deduplicates imports', () => {
    const code = `
import { a } from './shared.js';
import { b } from './shared.js';
`;
    const imports = extractImports(code);
    expect(imports.filter((i) => i === './shared.js')).toHaveLength(1);
  });
});

describe('checkAllImports', () => {
  it('passes node: built-in imports', async () => {
    const code = `import { readFileSync } from 'node:fs';`;
    const results = await checkAllImports(code, 'src/index.ts', TEST_ROOT);
    expect(results.every((r) => r.pass)).toBe(true);
  });

  it('passes valid relative imports', async () => {
    const code = `import { add } from './utils';`;
    const results = await checkAllImports(code, 'src/index.ts', TEST_ROOT);
    expect(results.every((r) => r.pass)).toBe(true);
  });

  it('fails for non-existent relative imports', async () => {
    const code = `import { foo } from './nonexistent.js';`;
    const results = await checkAllImports(code, 'src/index.ts', TEST_ROOT);
    expect(results.some((r) => !r.pass)).toBe(true);
  });
});

describe('HallucinationGuard', () => {
  it('validates a valid create_file action', async () => {
    const guard = new HallucinationGuard({
      projectRoot: TEST_ROOT,
      enabledChecks: {
        fileExistence: true,
        syntaxValidity: true,
        importValidity: false,
        sddCompliance: false,
      },
    });

    const result = await guard.validate({
      action: 'create_file',
      targetPath: 'new-file.ts',
      content: 'export const y = 2;',
      language: 'typescript',
    });
    expect(result.pass).toBe(true);
  });

  it('blocks reading a non-existent file', async () => {
    const guard = new HallucinationGuard({
      projectRoot: TEST_ROOT,
      enabledChecks: {
        fileExistence: true,
        syntaxValidity: false,
        importValidity: false,
        sddCompliance: false,
      },
    });

    const result = await guard.validate({
      action: 'read_file',
      targetPath: 'ghost.ts',
    });
    expect(result.pass).toBe(false);
    expect(result.blockedBy).toBeDefined();
    expect(result.blockedBy!.length).toBeGreaterThan(0);
  });

  it('validates code syntax when content is provided', async () => {
    const guard = new HallucinationGuard({
      projectRoot: TEST_ROOT,
      enabledChecks: {
        fileExistence: false,
        syntaxValidity: true,
        importValidity: false,
        sddCompliance: false,
      },
    });

    const result = await guard.validateCode('{ invalid json', 'json');
    expect(result.pass).toBe(false);
  });
});
