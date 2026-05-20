import { describe, expect, it } from 'vitest';
import {
  asRecord,
  cloneStringArray,
  inferModuleType,
  mapToRecord,
  normalizeModulePath,
  parentDirectoriesForPath,
  parseExports,
  parseImports,
  recordToClonedStringArrayMap,
  resolveImportPath,
  stringArray,
} from './helpers.js';

describe('asRecord', () => {
  it('returns object as Record', () => {
    const obj = { a: 1 };
    expect(asRecord(obj)).toBe(obj);
  });

  it('returns undefined for null', () => {
    expect(asRecord(null)).toBeUndefined();
  });

  it('returns undefined for primitives', () => {
    expect(asRecord(42)).toBeUndefined();
    expect(asRecord('str')).toBeUndefined();
    expect(asRecord(undefined)).toBeUndefined();
    expect(asRecord(true)).toBeUndefined();
  });

  it('returns arrays as records', () => {
    const arr = [1, 2];
    expect(asRecord(arr)).toBe(arr);
  });
});

describe('stringArray', () => {
  it('filters non-string items from array', () => {
    expect(stringArray(['a', 1, 'b', null, 'c'])).toEqual(['a', 'b', 'c']);
  });

  it('returns empty array for non-array input', () => {
    expect(stringArray(null)).toEqual([]);
    expect(stringArray(undefined)).toEqual([]);
    expect(stringArray('hello')).toEqual([]);
    expect(stringArray(42)).toEqual([]);
  });

  it('returns all items when all are strings', () => {
    expect(stringArray(['x', 'y', 'z'])).toEqual(['x', 'y', 'z']);
  });

  it('returns empty array for empty array input', () => {
    expect(stringArray([])).toEqual([]);
  });
});

describe('parseImports', () => {
  it('extracts ES6 named imports', () => {
    const code = `import { foo, bar } from './utils';`;
    expect(parseImports(code)).toEqual(['./utils']);
  });

  it('extracts ES6 default imports', () => {
    const code = `import React from 'react';`;
    expect(parseImports(code)).toEqual(['react']);
  });

  it('extracts namespace imports', () => {
    const code = `import * as path from 'node:path';`;
    expect(parseImports(code)).toEqual(['node:path']);
  });

  it('extracts side-effect imports', () => {
    const code = `import './polyfill';`;
    expect(parseImports(code)).toEqual(['./polyfill']);
  });

  it('extracts require calls', () => {
    const code = `const fs = require('fs');`;
    expect(parseImports(code)).toEqual(['fs']);
  });

  it('deduplicates repeated imports', () => {
    const code = `
import { a } from './shared';
import { b } from './shared';
import { c } from './other';
`;
    const result = parseImports(code);
    expect(result.filter((i) => i === './shared')).toHaveLength(1);
    expect(result).toContain('./other');
  });

  it('returns empty array for code without imports', () => {
    expect(parseImports('const x = 1;')).toEqual([]);
  });

  it('handles mixed import styles', () => {
    const code = `
import { readFile } from 'node:fs';
const path = require('path');
`;
    const result = parseImports(code);
    expect(result).toContain('node:fs');
    expect(result).toContain('path');
  });
});

describe('parseExports', () => {
  it('extracts named function exports', () => {
    const code = 'export function hello() {}';
    expect(parseExports(code).exports).toContain('hello');
  });

  it('extracts named const exports', () => {
    const code = 'export const VALUE = 42;';
    expect(parseExports(code).exports).toContain('VALUE');
  });

  it('extracts named class exports', () => {
    const code = 'export class MyService {}';
    expect(parseExports(code).exports).toContain('MyService');
  });

  it('extracts type and interface exports', () => {
    const code = `
export type Foo = string;
export interface Bar {}
`;
    const result = parseExports(code);
    expect(result.exports).toContain('Foo');
    expect(result.exports).toContain('Bar');
  });

  it('extracts brace exports', () => {
    const code = 'export { foo, bar };';
    const result = parseExports(code);
    expect(result.exports).toContain('foo');
    expect(result.exports).toContain('bar');
  });

  it('handles aliased brace exports', () => {
    const code = 'export { internal as external };';
    const result = parseExports(code);
    expect(result.exports).toContain('external');
  });

  it('detects default export with name', () => {
    const code = 'export default function main() {}';
    expect(parseExports(code).defaultExport).toBe('main');
  });

  it('detects anonymous default export', () => {
    const code = 'export default {};';
    expect(parseExports(code).defaultExport).toBe('default');
  });

  it('returns empty for no exports', () => {
    const result = parseExports('const x = 1;');
    expect(result.exports).toEqual([]);
    expect(result.defaultExport).toBeUndefined();
  });

  it('deduplicates exports', () => {
    const code = `
export const foo = 1;
export { foo };
`;
    const result = parseExports(code);
    expect(result.exports.filter((e) => e === 'foo')).toHaveLength(1);
  });
});
describe('inferModuleType', () => {
  it('detects component paths', () => {
    expect(inferModuleType('src/components/Button.tsx')).toBe('component');
  });

  it('detects page paths', () => {
    expect(inferModuleType('src/pages/Home.tsx')).toBe('page');
    expect(inferModuleType('src/views/Dashboard.tsx')).toBe('page');
  });

  it('detects store paths', () => {
    expect(inferModuleType('src/stores/auth.ts')).toBe('store');
    expect(inferModuleType('src/store/index.ts')).toBe('store');
  });

  it('detects api paths', () => {
    expect(inferModuleType('src/api/client.ts')).toBe('api');
    expect(inferModuleType('src/services/user.ts')).toBe('api');
  });

  it('detects util paths', () => {
    expect(inferModuleType('src/utils/format.ts')).toBe('util');
    expect(inferModuleType('src/helpers/math.ts')).toBe('util');
    expect(inferModuleType('src/lib/crypto.ts')).toBe('util');
  });

  it('detects config paths', () => {
    expect(inferModuleType('vite.config.ts')).toBe('config');
    expect(inferModuleType('jest.config.js')).toBe('config');
    expect(inferModuleType('src/config/env.ts')).toBe('config');
  });

  it('detects style paths', () => {
    expect(inferModuleType('src/styles/main.css')).toBe('style');
    expect(inferModuleType('src/theme.scss')).toBe('style');
    expect(inferModuleType('src/vars.less')).toBe('style');
  });

  it('returns other for unrecognized paths', () => {
    expect(inferModuleType('src/index.ts')).toBe('other');
    expect(inferModuleType('README.md')).toBe('other');
  });

  it('is case-insensitive', () => {
    expect(inferModuleType('src/Components/Button.tsx')).toBe('component');
    expect(inferModuleType('src/UTILS/format.ts')).toBe('util');
  });
});

describe('resolveImportPath', () => {
  it('resolves relative sibling imports', () => {
    const result = resolveImportPath('./utils', 'src/components/Button.tsx', '/project');
    expect(result).toBe('src/components/utils.tsx');
  });

  it('resolves parent directory imports', () => {
    const result = resolveImportPath('../helpers/format', 'src/components/Button.tsx', '/project');
    expect(result).toBe('src/helpers/format.tsx');
  });

  it('resolves @/ alias imports', () => {
    const result = resolveImportPath('@/utils/format', 'src/components/Button.tsx', '/project');
    expect(result).toBe('src/utils/format.tsx');
  });

  it('returns null for external packages', () => {
    expect(resolveImportPath('react', 'src/app.tsx', '/project')).toBeNull();
    expect(resolveImportPath('lodash/get', 'src/app.tsx', '/project')).toBeNull();
  });

  it('returns null for node: prefixed imports', () => {
    expect(resolveImportPath('node:fs', 'src/app.tsx', '/project')).toBeNull();
  });
});

describe('normalizeModulePath', () => {
  it('returns path unchanged if it has a known extension', () => {
    expect(normalizeModulePath('src/app.ts')).toBe('src/app.ts');
    expect(normalizeModulePath('src/app.tsx')).toBe('src/app.tsx');
    expect(normalizeModulePath('src/app.js')).toBe('src/app.js');
    expect(normalizeModulePath('src/app.jsx')).toBe('src/app.jsx');
    expect(normalizeModulePath('src/app.mjs')).toBe('src/app.mjs');
    expect(normalizeModulePath('src/app.cjs')).toBe('src/app.cjs');
  });

  it('appends .tsx for paths without extension', () => {
    expect(normalizeModulePath('src/utils/format')).toBe('src/utils/format.tsx');
  });
});

describe('parentDirectoriesForPath', () => {
  it('returns parent directories for nested path', () => {
    expect(parentDirectoriesForPath('src/components/ui/Button.tsx')).toEqual([
      'src',
      'src/components',
      'src/components/ui',
    ]);
  });

  it('returns single parent for two-level path', () => {
    expect(parentDirectoriesForPath('src/index.ts')).toEqual(['src']);
  });

  it('returns empty array for root-level file', () => {
    expect(parentDirectoriesForPath('index.ts')).toEqual([]);
  });

  it('handles leading slash', () => {
    const result = parentDirectoriesForPath('/src/app.ts');
    expect(result).toEqual(['src']);
  });
});

describe('mapToRecord', () => {
  it('converts Map to Record', () => {
    const map = new Map([
      ['a', 1],
      ['b', 2],
    ]);
    expect(mapToRecord(map)).toEqual({ a: 1, b: 2 });
  });

  it('applies cloneValue when provided', () => {
    const map = new Map([['x', [1, 2]]]);
    const result = mapToRecord(map, (v) => [...v]);
    expect(result).toEqual({ x: [1, 2] });
    expect(result.x).not.toBe(map.get('x'));
  });

  it('returns empty object for empty map', () => {
    expect(mapToRecord(new Map())).toEqual({});
  });
});

describe('cloneStringArray', () => {
  it('returns a shallow copy', () => {
    const input = ['a', 'b'];
    const result = cloneStringArray(input);
    expect(result).toEqual(input);
    expect(result).not.toBe(input);
  });
});

describe('recordToClonedStringArrayMap', () => {
  it('converts Record to Map with cloned arrays', () => {
    const record = { x: ['a', 'b'], y: ['c'] };
    const map = recordToClonedStringArrayMap(record);
    expect(map.get('x')).toEqual(['a', 'b']);
    expect(map.get('y')).toEqual(['c']);
    expect(map.get('x')).not.toBe(record.x);
  });

  it('returns empty map for empty record', () => {
    const map = recordToClonedStringArrayMap({});
    expect(map.size).toBe(0);
  });
});
