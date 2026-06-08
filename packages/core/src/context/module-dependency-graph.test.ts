import { describe, expect, it } from 'vitest';
import type { ModuleDependencyGraph } from '../types.js';
import { updateModuleDependencyGraphFromToolResult } from './module-dependency-graph.js';

function makeGraph(): ModuleDependencyGraph {
  return {
    modules: new Map(),
    dependencies: new Map(),
    reverseDependencies: new Map(),
  };
}

describe('updateModuleDependencyGraphFromToolResult', () => {
  it('ignores failed results', () => {
    const graph = makeGraph();

    const changed = updateModuleDependencyGraphFromToolResult(
      graph,
      'create_file',
      { path: 'src/app.ts', content: 'export const app = true;' },
      { success: false },
    );

    expect(changed).toBe(false);
    expect(graph.modules.size).toBe(0);
    expect(graph.dependencies.size).toBe(0);
    expect(graph.reverseDependencies.size).toBe(0);
  });

  it('ignores unsupported tools and non-module files', () => {
    const graph = makeGraph();

    expect(
      updateModuleDependencyGraphFromToolResult(
        graph,
        'read_file',
        { path: 'src/app.ts', content: 'export const app = true;' },
        { success: true },
      ),
    ).toBe(false);
    expect(
      updateModuleDependencyGraphFromToolResult(
        graph,
        'create_file',
        { path: 'README.md', content: '# docs' },
        { success: true },
      ),
    ).toBe(false);
    expect(graph.modules.size).toBe(0);
  });

  it('records module metadata and reverse dependencies for created code files', () => {
    const graph = makeGraph();

    const changed = updateModuleDependencyGraphFromToolResult(
      graph,
      'create_file',
      {
        path: 'src/components/App.tsx',
        content: "import { format } from '../utils/format';\nexport default function App() {}",
      },
      { success: true },
    );

    expect(changed).toBe(true);
    expect(graph.modules.get('src/components/App.tsx')).toMatchObject({
      path: 'src/components/App.tsx',
      type: 'component',
      imports: ['../utils/format'],
      defaultExport: 'App',
    });
    expect(graph.dependencies.get('src/components/App.tsx')).toEqual(['src/utils/format.tsx']);
    expect(graph.reverseDependencies.get('src/utils/format.tsx')).toEqual([
      'src/components/App.tsx',
    ]);
  });

  it('replaces stale reverse dependencies when a module is updated', () => {
    const graph = makeGraph();

    updateModuleDependencyGraphFromToolResult(
      graph,
      'create_file',
      {
        path: 'src/App.tsx',
        content: "import { oldValue } from './old';\nexport const app = oldValue;",
      },
      { success: true },
    );
    updateModuleDependencyGraphFromToolResult(
      graph,
      'apply_patch',
      {
        path: 'src/App.tsx',
        content: "import { nextValue } from './next';\nexport const app = nextValue;",
      },
      { success: true },
    );

    expect(graph.dependencies.get('src/App.tsx')).toEqual(['src/next.tsx']);
    expect(graph.reverseDependencies.has('src/old.tsx')).toBe(false);
    expect(graph.reverseDependencies.get('src/next.tsx')).toEqual(['src/App.tsx']);
  });

  it('uses result content when params omit content', () => {
    const graph = makeGraph();

    updateModuleDependencyGraphFromToolResult(
      graph,
      'apply_patch',
      { path: 'src/store/auth.ts' },
      { success: true, content: 'export const authStore = {};' },
    );

    expect(graph.modules.get('src/store/auth.ts')).toMatchObject({
      exports: ['authStore'],
      type: 'store',
    });
  });
});
