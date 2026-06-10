# mcp-file list_directory maxDepth Clamp + Entry Budget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clamp `maxDepth`, add a `maxEntries` budget with truncation metadata to the `list_directory` tool so it can never produce unbounded MCP responses (Issue #274).

**Architecture:** All logic lives in `packages/mcp-file/src/tools/list-directory.ts`. Input normalization rejects non-positive-integer `maxDepth`/`maxEntries` and clamps them to hard limits (depth ≤ 10, entries ≤ 2000). Traversal carries a shared mutable budget; once exhausted it stops collecting but keeps counting omitted entries (within the same depth/ignore rules) so the result can report `truncated: true` plus `omittedEntries`, mirroring the filesense `navigate` pattern and the `search_code` `truncated` flag. `server.ts` passes args straight through, so no wiring changes are needed.

**Tech Stack:** TypeScript, Node `fs` sync APIs, vitest.

**GitNexus impact:** `listDirectory` and `listRecursive` are both LOW risk — sole upstream consumer is `packages/mcp-file/src/server.ts`; no execution flows affected.

---

### Task 1: Regression tests for clamp + budget (failing first)

**Files:**
- Create: `packages/mcp-file/src/tools/list-directory.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { listDirectory } from './list-directory.js';

let roots: string[] = [];

function makeRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'mcp-file-list-'));
  roots.push(root);
  return root;
}

/** Creates root/d1/d2/.../d{depth}, each level containing marker.txt */
function makeDeepFixture(root: string, depth: number): void {
  let current = root;
  for (let i = 1; i <= depth; i += 1) {
    current = join(current, `d${i}`);
    mkdirSync(current);
    writeFileSync(join(current, 'marker.txt'), `level ${i}`, 'utf-8');
  }
}

/** Creates `count` flat files file-0000.txt ... in root/flat */
function makeFlatFixture(root: string, count: number): void {
  const dir = join(root, 'flat');
  mkdirSync(dir);
  for (let i = 0; i < count; i += 1) {
    writeFileSync(join(dir, `file-${String(i).padStart(4, '0')}.txt`), 'x', 'utf-8');
  }
}

afterEach(() => {
  for (const root of roots) {
    rmSync(root, { recursive: true, force: true });
  }
  roots = [];
});

describe('listDirectory maxDepth clamping', () => {
  it('clamps oversized maxDepth to the hard limit of 10', () => {
    const root = makeRoot();
    makeDeepFixture(root, 13);

    const result = listDirectory({ path: '.', recursive: true, maxDepth: 999999 }, root);
    expect(result.success).toBe(true);
    const paths = (result.entries ?? []).map((entry) => entry.path);
    // maxDepth=10 lists items down to call depth 10, i.e. contents of d10 (d11 + its marker)
    expect(paths).toContain(join('d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8', 'd9', 'd10', 'd11'));
    expect(paths.some((p) => p.endsWith(join('d11', 'd12')))).toBe(false);
    expect(paths.some((p) => p.endsWith(join('d12', 'marker.txt')))).toBe(false);
  });

  it.each([
    ['zero', 0],
    ['negative', -3],
    ['non-integer', 2.5],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['NaN', Number.NaN],
  ])('rejects %s maxDepth with an error', (_label, maxDepth) => {
    const root = makeRoot();
    makeDeepFixture(root, 2);

    const result = listDirectory({ path: '.', recursive: true, maxDepth }, root);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/maxDepth/);
  });

  it('keeps the default depth of 3 when maxDepth is omitted', () => {
    const root = makeRoot();
    makeDeepFixture(root, 6);

    const result = listDirectory({ path: '.', recursive: true }, root);
    expect(result.success).toBe(true);
    const paths = (result.entries ?? []).map((entry) => entry.path);
    expect(paths).toContain(join('d1', 'd2', 'd3', 'd4'));
    expect(paths.some((p) => p.endsWith(join('d4', 'd5')))).toBe(false);
  });
});

describe('listDirectory entry budget', () => {
  it('truncates at maxEntries and reports omitted count', () => {
    const root = makeRoot();
    makeFlatFixture(root, 10);

    const result = listDirectory({ path: 'flat', maxEntries: 3 }, root);
    expect(result.success).toBe(true);
    expect(result.entries).toHaveLength(3);
    expect(result.truncated).toBe(true);
    expect(result.omittedEntries).toBe(7);
  });

  it('reports truncated: false when under budget', () => {
    const root = makeRoot();
    makeFlatFixture(root, 5);

    const result = listDirectory({ path: 'flat', maxEntries: 100 }, root);
    expect(result.success).toBe(true);
    expect(result.entries).toHaveLength(5);
    expect(result.truncated).toBe(false);
    expect(result.omittedEntries).toBeUndefined();
  });

  it('counts omitted entries across recursive subdirectories', () => {
    const root = makeRoot();
    makeDeepFixture(root, 4); // 4 dirs + 4 markers = 8 entries total

    const result = listDirectory({ path: '.', recursive: true, maxDepth: 10, maxEntries: 2 }, root);
    expect(result.success).toBe(true);
    expect(result.entries).toHaveLength(2);
    expect(result.truncated).toBe(true);
    expect(result.omittedEntries).toBe(6);
  });

  it('clamps oversized maxEntries to the hard limit of 2000', () => {
    const root = makeRoot();
    makeFlatFixture(root, 2005);

    const result = listDirectory({ path: 'flat', maxEntries: 999999 }, root);
    expect(result.success).toBe(true);
    expect(result.entries).toHaveLength(2000);
    expect(result.truncated).toBe(true);
    expect(result.omittedEntries).toBe(5);
  });

  it.each([
    ['zero', 0],
    ['negative', -1],
    ['non-integer', 1.5],
  ])('rejects %s maxEntries with an error', (_label, maxEntries) => {
    const root = makeRoot();
    makeFlatFixture(root, 1);

    const result = listDirectory({ path: 'flat', maxEntries }, root);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/maxEntries/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @frontagent/mcp-file test -- list-directory`
Expected: FAIL — clamp tests see entries below depth 10 / invalid-input tests get `success: true`; budget tests find `truncated` undefined.

### Task 2: Implement clamp + budget in list-directory.ts

**Files:**
- Modify: `packages/mcp-file/src/tools/list-directory.ts`

- [ ] **Step 1: Implement normalization, budget traversal, result metadata, schema update**

Add constants and a validator above `listDirectory`:

```typescript
const DEFAULT_MAX_DEPTH = 3;
const MAX_DEPTH_LIMIT = 10;
const DEFAULT_MAX_ENTRIES = 2000;
const MAX_ENTRIES_LIMIT = 2000;

interface TraversalBudget {
  remaining: number;
  omitted: number;
}

function normalizePositiveInteger(
  value: number | undefined,
  name: string,
  defaultValue: number,
  limit: number,
): { ok: true; value: number } | { ok: false; error: string } {
  if (value === undefined) {
    return { ok: true, value: defaultValue };
  }
  if (!Number.isInteger(value) || value < 1) {
    return { ok: false, error: `${name} must be a positive integer, got: ${value}` };
  }
  return { ok: true, value: Math.min(value, limit) };
}
```

Extend the interfaces:

```typescript
export interface ListDirectoryParams {
  path: string;
  recursive?: boolean;
  includeHidden?: boolean;
  maxDepth?: number;
  maxEntries?: number;
}

export interface ListDirectoryResult {
  success: boolean;
  entries?: FileInfo[];
  truncated?: boolean;
  omittedEntries?: number;
  error?: string;
}
```

In `listDirectory`, normalize before traversal and thread the budget through:

```typescript
const { path: dirPath, recursive = false, includeHidden = false } = params;

const maxDepth = normalizePositiveInteger(params.maxDepth, 'maxDepth', DEFAULT_MAX_DEPTH, MAX_DEPTH_LIMIT);
if (!maxDepth.ok) {
  return { success: false, error: maxDepth.error };
}
const maxEntries = normalizePositiveInteger(params.maxEntries, 'maxEntries', DEFAULT_MAX_ENTRIES, MAX_ENTRIES_LIMIT);
if (!maxEntries.ok) {
  return { success: false, error: maxEntries.error };
}
```

and in the `try` block:

```typescript
const budget: TraversalBudget = { remaining: maxEntries.value, omitted: 0 };
const entries = listRecursive(
  safePath.fullPath,
  getRealProjectRoot(projectRoot),
  recursive,
  includeHidden,
  0,
  maxDepth.value,
  budget,
);
return {
  success: true,
  entries,
  truncated: budget.omitted > 0,
  ...(budget.omitted > 0 ? { omittedEntries: budget.omitted } : {}),
};
```

In `listRecursive`, add the `budget: TraversalBudget` parameter; replace the unconditional `entries.push(fileInfo)` with budget accounting (only build/stat-decorate the FileInfo when within budget; otherwise count it as omitted) while still recursing into subdirectories so omitted entries are counted:

```typescript
if (budget.remaining > 0) {
  budget.remaining -= 1;
  const fileInfo: FileInfo = {
    name: item,
    path: relativePath,
    type: itemStat.isDirectory() ? 'directory' : 'file',
  };
  if (itemStat.isFile()) {
    fileInfo.size = itemStat.size;
    fileInfo.modifiedAt = itemStat.mtime.toISOString();
  }
  entries.push(fileInfo);
} else {
  budget.omitted += 1;
}
```

Update `listDirectorySchema.inputSchema.properties`:

```typescript
maxDepth: {
  type: 'number',
  description: '递归时的最大深度，默认 3，必须是正整数，上限 10',
  default: 3,
},
maxEntries: {
  type: 'number',
  description: '返回条目数预算，默认 2000，必须是正整数，上限 2000；超出时 truncated 为 true 并返回 omittedEntries',
  default: 2000,
},
```

- [ ] **Step 2: Run the focused tests**

Run: `pnpm --filter @frontagent/mcp-file test -- list-directory`
Expected: PASS (all new tests green).

- [ ] **Step 3: Run the full mcp-file package tests**

Run: `pnpm --filter @frontagent/mcp-file test`
Expected: PASS — no regressions in sibling tool tests.

- [ ] **Step 4: Commit**

```bash
git add packages/mcp-file/src/tools/list-directory.ts packages/mcp-file/src/tools/list-directory.test.ts docs/superpowers/plans/2026-06-11-mcp-file-list-directory-budget.md
git commit -m "fix(mcp-file): clamp list_directory maxDepth and add maxEntries budget"
```

### Task 3: Gates before PR

- [ ] **Step 1: Run precommit gate**

Run: `pnpm quality:precommit`
Expected: PASS.

- [ ] **Step 2: Run GitNexus detect_changes**

Run `gitnexus_detect_changes()` (scope: all) — verify only `listDirectory`/`listRecursive`/schema symbols in `packages/mcp-file` are affected.
