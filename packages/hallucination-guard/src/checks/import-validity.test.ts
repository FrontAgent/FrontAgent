import { describe, expect, it } from 'vitest';
import { extractImports } from './import-validity.js';

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
