# Filesense Engine Query Helpers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract one remaining `mcp-filesense` query result shaping responsibility from `packages/mcp-filesense/src/engine.ts` without changing public tool output.

**Architecture:** Keep filesystem lookup, config resolution, index reads, and error behavior in `engine.ts`. Add a pure `packages/mcp-filesense/src/engine-query.ts` helper that builds the existing `QueryResult` object from already-loaded root/target/index/notes inputs, making the response shape independently testable.

**Tech Stack:** TypeScript, Vitest, existing `@frontagent/mcp-filesense` package scripts.

---

### Task 1: Query Result Shaping Helper

**Files:**
- Create: `packages/mcp-filesense/src/engine-query.ts`
- Create: `packages/mcp-filesense/src/engine-query.test.ts`
- Modify: `packages/mcp-filesense/src/engine.ts:734-746`

**GitNexus Impact:**
- `npx gitnexus impact query --direction upstream --repo /Users/ceilf6/.config/superpowers/worktrees/FrontAgent-app/improve-filesense-engine-query-helpers --file packages/mcp-filesense/src/engine.ts --include-tests`
- Risk level: LOW
- Blast radius: one direct test-file dependent, `packages/mcp-filesense/src/engine.test.ts`; no affected execution processes or modules.

- [x] **Step 1: Add the focused failing test**

Create `packages/mcp-filesense/src/engine-query.test.ts` with tests that call `buildQueryResult` directly and assert the exact existing root-relative path behavior:

```ts
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildQueryResult } from './engine-query.js';
import type { IndexFile, NotesFile } from './types.js';

const index: IndexFile = {
  schema_version: '1.0',
  generated_at: '2026-06-08T00:00:00.000Z',
  root_relative_path: '.',
  directory: { name: 'workspace', path: '.' },
  children: [],
  sync: {
    child_count: 0,
    file_count: 0,
    dir_count: 0,
    last_full_sync: null,
    last_incremental_sync: null,
  },
};

const notes: NotesFile = {
  directory_purpose: 'Project root directory containing source code.',
};

describe('engine query helpers', () => {
  it('builds root query results with dot rootRelativePath', () => {
    const result = buildQueryResult({
      root: '/repo',
      target: '/repo',
      index,
      notes,
    });

    expect(result).toEqual({
      root: '/repo',
      target: '/repo',
      rootRelativePath: '.',
      index,
      notes,
    });
  });

  it('builds nested query results with native path.relative semantics', () => {
    const result = buildQueryResult({
      root: '/repo',
      target: '/repo/src\\components',
      index,
      notes: null,
    });

    expect(result.rootRelativePath).toBe(path.relative('/repo', '/repo/src\\components'));
    expect(result.notes).toBeNull();
  });
});
```

Run: `pnpm --filter @frontagent/mcp-filesense test -- engine-query.test.ts`
Expected before implementation: FAIL because `./engine-query.js` does not exist.

- [x] **Step 2: Implement the helper**

Create `packages/mcp-filesense/src/engine-query.ts`:

```ts
import path from 'node:path';
import type { IndexFile, NotesFile, QueryResult } from './types.js';

export interface BuildQueryResultOptions {
  root: string;
  target: string;
  index: IndexFile;
  notes: NotesFile | null;
}

export function buildQueryResult({
  root,
  target,
  index,
  notes,
}: BuildQueryResultOptions): QueryResult {
  const relative = path.relative(root, target);
  return {
    root,
    target,
    rootRelativePath: relative === '' ? '.' : relative,
    index,
    notes,
  };
}
```

- [x] **Step 3: Delegate `engine.query` result shaping**

In `packages/mcp-filesense/src/engine.ts`, import `buildQueryResult` and replace the inline final return with:

```ts
return buildQueryResult({ root, target, index, notes });
```

- [x] **Step 4: Verify focused and package gates**

Run:

```bash
pnpm --filter @frontagent/mcp-filesense test -- engine-query.test.ts engine.test.ts
pnpm --filter @frontagent/mcp-filesense test
pnpm --filter @frontagent/mcp-filesense typecheck
```

- [x] **Step 5: Final scope inspection**

Run:

```bash
npx gitnexus detect-changes --repo /Users/ceilf6/.config/superpowers/worktrees/FrontAgent-app/improve-filesense-engine-query-helpers --scope all
pnpm quality:precommit
```

Expected: changed symbols are limited to the new query helper/test, the `query` delegation, and this plan.
