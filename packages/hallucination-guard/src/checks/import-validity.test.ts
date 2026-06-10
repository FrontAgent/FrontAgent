import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { checkImportValidity, extractImports } from './import-validity.js';

let roots: string[] = [];

function makeRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'hallucination-guard-'));
  roots.push(root);
  return root;
}

afterEach(() => {
  for (const root of roots) {
    rmSync(root, { recursive: true, force: true });
  }
  roots = [];
});

describe('checkImportValidity', () => {
  it('passes for resolvable relative import', async () => {
    const root = makeRoot();
    mkdirSync(join(root, 'src'));
    writeFileSync(join(root, 'src', 'app.ts'), '', 'utf-8');
    writeFileSync(join(root, 'src', 'utils.ts'), '', 'utf-8');

    const result = await checkImportValidity({
      importPath: './utils',
      sourceFilePath: 'src/app.ts',
      projectRoot: root,
    });
    expect(result.pass).toBe(true);
    expect(result.type).toBe('import_validity');
  });

  it('resolves relative import to index file', async () => {
    const root = makeRoot();
    mkdirSync(join(root, 'src', 'lib'), { recursive: true });
    writeFileSync(join(root, 'src', 'lib', 'index.ts'), '', 'utf-8');

    const result = await checkImportValidity({
      importPath: './lib',
      sourceFilePath: 'src/app.ts',
      projectRoot: root,
    });
    expect(result.pass).toBe(true);
  });

  it('fails for unresolvable relative import', async () => {
    const root = makeRoot();
    mkdirSync(join(root, 'src'));

    const result = await checkImportValidity({
      importPath: './missing',
      sourceFilePath: 'src/app.ts',
      projectRoot: root,
    });
    expect(result.pass).toBe(false);
    expect(result.severity).toBe('block');
    expect(result.message).toMatch(/cannot resolve/i);
  });

  it('blocks relative import escaping the project root even if the target exists', async () => {
    const root = makeRoot();
    mkdirSync(join(root, 'src'));

    const result = await checkImportValidity({
      importPath: '../'.repeat(20) + 'etc/hosts',
      sourceFilePath: 'src/app.ts',
      projectRoot: root,
    });
    expect(result.pass).toBe(false);
    expect(result.severity).toBe('block');
    expect(result.message).toMatch(/outside project root/i);
  });

  it('blocks absolute import outside the project root even if the target exists', async () => {
    const root = makeRoot();

    const result = await checkImportValidity({
      importPath: '/etc/hosts',
      sourceFilePath: 'src/app.ts',
      projectRoot: root,
    });
    expect(result.pass).toBe(false);
    expect(result.severity).toBe('block');
    expect(result.message).toMatch(/outside project root/i);
  });

  it('blocks import into a sibling directory sharing the project root prefix', async () => {
    const root = makeRoot();
    const sibling = `${root}-secret`;
    mkdirSync(sibling);
    roots.push(sibling);
    writeFileSync(join(sibling, 'leak.ts'), '', 'utf-8');
    mkdirSync(join(root, 'src'));

    const result = await checkImportValidity({
      importPath: relative(join(root, 'src'), join(sibling, 'leak.ts')),
      sourceFilePath: 'src/app.ts',
      projectRoot: root,
    });
    expect(result.pass).toBe(false);
    expect(result.severity).toBe('block');
    expect(result.message).toMatch(/outside project root/i);
  });

  it('passes for node builtin modules', async () => {
    const root = makeRoot();

    const result = await checkImportValidity({
      importPath: 'node:path',
      sourceFilePath: 'src/app.ts',
      projectRoot: root,
    });
    expect(result.pass).toBe(true);
  });

  it('blocks uninstalled external packages', async () => {
    const root = makeRoot();
    writeFileSync(join(root, 'package.json'), JSON.stringify({ dependencies: {} }), 'utf-8');

    const result = await checkImportValidity({
      importPath: 'totally-hallucinated-pkg',
      sourceFilePath: 'src/app.ts',
      projectRoot: root,
    });
    expect(result.pass).toBe(false);
    expect(result.severity).toBe('block');
  });
});

describe('extractImports', () => {
  it('extracts ES6 named imports', () => {
    const code = `import { foo, bar } from './utils';`;
    expect(extractImports(code)).toEqual(['./utils']);
  });

  it('extracts ES6 default imports', () => {
    const code = `import React from 'react';`;
    expect(extractImports(code)).toEqual(['react']);
  });

  it('extracts ES6 namespace imports', () => {
    const code = `import * as path from 'node:path';`;
    expect(extractImports(code)).toEqual(['node:path']);
  });

  it('extracts side-effect imports', () => {
    const code = `import './polyfill';`;
    expect(extractImports(code)).toEqual(['./polyfill']);
  });

  it('extracts dynamic imports', () => {
    const code = `const mod = await import('./lazy-module');`;
    expect(extractImports(code)).toEqual(['./lazy-module']);
  });

  it('extracts require calls', () => {
    const code = `const fs = require('fs');`;
    expect(extractImports(code)).toEqual(['fs']);
  });

  it('extracts multiple imports and deduplicates', () => {
    const code = `
import { a } from './shared';
import { b } from './shared';
import { c } from './other';
`;
    const result = extractImports(code);
    expect(result).toContain('./shared');
    expect(result).toContain('./other');
    expect(result.filter((i) => i === './shared')).toHaveLength(1);
  });

  it('handles mixed import styles', () => {
    const code = `
import { readFile } from 'node:fs';
const path = require('path');
const lazy = await import('./lazy');
`;
    const result = extractImports(code);
    expect(result).toContain('node:fs');
    expect(result).toContain('path');
    expect(result).toContain('./lazy');
  });

  it('returns empty array for code without imports', () => {
    const code = 'const x = 1;\nconsole.log(x);';
    expect(extractImports(code)).toEqual([]);
  });
});
