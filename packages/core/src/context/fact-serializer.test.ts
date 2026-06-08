import { describe, expect, it } from 'vitest';
import type { ModuleInfo, ProjectFacts } from '../types.js';
import { serializeProjectFactsForLLM } from './fact-serializer.js';

function makeModule(path: string, exports: string[]): ModuleInfo {
  return {
    path,
    type: 'util',
    exports,
    imports: [],
    createdAt: 1,
  };
}

function makeFacts(): ProjectFacts {
  return {
    revision: 3,
    filesystem: {
      existingFiles: new Set(['src/a.ts']),
      existingDirectories: new Set(['src']),
      nonExistentPaths: new Set(['src/missing.ts']),
      directoryContents: new Map([
        ['src', ['src/a.ts', 'src/b.ts', 'src/c.ts', 'src/d.ts', 'src/e.ts', 'src/f.ts']],
      ]),
    },
    dependencies: {
      installedPackages: new Set(['react']),
      missingPackages: new Set(['lodash']),
    },
    project: {
      devServerRunning: true,
      runningPort: 5173,
      buildStatus: 'failed',
    },
    moduleDependencyGraph: {
      modules: new Map([['src/a.ts', makeModule('src/a.ts', ['a', 'b', 'c', 'd'])]]),
      dependencies: new Map(),
      reverseDependencies: new Map(),
    },
    errors: Array.from({ length: 6 }, (_, index) => ({
      stepId: `s${index}`,
      type: 'tool',
      message: `error ${index}`,
      timestamp: index,
    })),
  };
}

describe('serializeProjectFactsForLLM', () => {
  it('preserves readable fact output and applies existing prompt budgets', () => {
    const text = serializeProjectFactsForLLM(makeFacts(), {
      missingModuleReferences: Array.from({ length: 11 }, (_, index) => ({
        from: `src/file-${index}.ts`,
        missing: `src/missing-${index}.ts`,
        importPath: `./missing-${index}`,
      })),
    });

    expect(text).toContain('## 事实版本: 3');
    expect(text).toContain('- src/ (包含: src/a.ts, src/b.ts, src/c.ts, src/d.ts, src/e.ts...)');
    expect(text).toContain('导出: a, b, c...');
    expect(text).toContain('- src/file-9.ts 引用了不存在的模块: ./missing-9');
    expect(text).toContain('... 还有 1 个缺失引用');
    expect(text).not.toContain('- src/file-10.ts 引用了不存在的模块: ./missing-10');
    expect(text).not.toContain('error 0');
    expect(text).toContain('error 5');
  });
});
