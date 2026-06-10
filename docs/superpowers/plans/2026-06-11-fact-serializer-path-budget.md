# Fact Serializer Path Budget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cap the unbounded `existingFiles`, `existingDirectories`, and `nonExistentPaths` lists that `serializeProjectFactsForLLM` injects into LLM prompts (Issue #277).

**Architecture:** Apply the same budget pattern already used by `MISSING_MODULE_REFERENCE_LIMIT` / `RECENT_ERROR_LIMIT` in `packages/core/src/context/fact-serializer.ts`. The fact sets are insertion-ordered (`addToSet` in `filesystem-facts-update.ts` only inserts new entries), so the tail of each Set is the most recently discovered paths — emit the last N entries plus a `... 还有 N 个` marker, mirroring the errors section that uses `slice(-RECENT_ERROR_LIMIT)`. In-memory facts storage is untouched; only the LLM serialization is capped.

**Tech Stack:** TypeScript, vitest.

---

### Task 1: Budget the three filesystem path sections in the serializer

**Files:**
- Modify: `packages/core/src/context/fact-serializer.ts` (lines 1–56)
- Test: `packages/core/src/context/fact-serializer.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `packages/core/src/context/fact-serializer.test.ts` inside the existing `describe` block:

```ts
  it('caps filesystem path lists and reports how many entries were omitted', () => {
    const facts = makeFacts();
    facts.filesystem.existingFiles = new Set(
      Array.from({ length: 35 }, (_, index) => `src/file-${index}.ts`),
    );
    facts.filesystem.existingDirectories = new Set(
      Array.from({ length: 25 }, (_, index) => `src/dir-${index}`),
    );
    facts.filesystem.directoryContents = new Map();
    facts.filesystem.nonExistentPaths = new Set(
      Array.from({ length: 20 }, (_, index) => `src/missing-${index}.ts`),
    );

    const text = serializeProjectFactsForLLM(facts);

    // Most recently recorded entries are kept.
    expect(text).toContain('- src/file-34.ts');
    expect(text).toContain('- src/file-5.ts');
    expect(text).not.toContain('- src/file-4.ts');
    expect(text).toContain('... 还有 5 个已确认存在的文件（共 35 个，仅显示最近 30 个）');

    expect(text).toContain('- src/dir-24/');
    expect(text).toContain('- src/dir-5/');
    expect(text).not.toContain('- src/dir-4/');
    expect(text).toContain('... 还有 5 个已确认存在的目录（共 25 个，仅显示最近 20 个）');

    expect(text).toContain('- src/missing-19.ts');
    expect(text).toContain('- src/missing-5.ts');
    expect(text).not.toContain('- src/missing-4.ts');
    expect(text).toContain('... 还有 5 个已确认不存在的路径（共 20 个，仅显示最近 15 个）');
  });

  it('emits no truncation marker when path lists are within budget', () => {
    const text = serializeProjectFactsForLLM(makeFacts());
    expect(text).toContain('- src/a.ts');
    expect(text).toContain('- src/missing.ts');
    expect(text).not.toContain('仅显示最近');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run packages/core/src/context/fact-serializer.test.ts`
Expected: FAIL — the new truncation-marker assertions fail (`... 还有 5 个已确认存在的文件...` not found) because the serializer currently emits every entry.

- [ ] **Step 3: Write the implementation**

In `packages/core/src/context/fact-serializer.ts`, add constants after line 6 (`RECENT_ERROR_LIMIT`):

```ts
const EXISTING_FILE_DISPLAY_LIMIT = 30;
const EXISTING_DIRECTORY_DISPLAY_LIMIT = 20;
const NON_EXISTENT_PATH_DISPLAY_LIMIT = 15;
```

Add a helper above `serializeProjectFactsForLLM`:

```ts
function pushBudgetedPathSection(
  parts: string[],
  paths: Set<string>,
  limit: number,
  label: string,
  renderEntry: (path: string) => string,
): void {
  const entries = Array.from(paths);
  const shown = entries.length > limit ? entries.slice(-limit) : entries;
  for (const entry of shown) {
    parts.push(renderEntry(entry));
  }
  if (entries.length > limit) {
    parts.push(`... 还有 ${entries.length - limit} 个${label}（共 ${entries.length} 个，仅显示最近 ${limit} 个）`);
  }
}
```

Replace the three loops (current lines 28–56) with:

```ts
  if (facts.filesystem.existingFiles.size > 0) {
    parts.push('\n### 已确认存在的文件:');
    pushBudgetedPathSection(
      parts,
      facts.filesystem.existingFiles,
      EXISTING_FILE_DISPLAY_LIMIT,
      '已确认存在的文件',
      (file) => `- ${file}`,
    );
  }

  if (facts.filesystem.existingDirectories.size > 0) {
    parts.push('\n### 已确认存在的目录:');
    pushBudgetedPathSection(
      parts,
      facts.filesystem.existingDirectories,
      EXISTING_DIRECTORY_DISPLAY_LIMIT,
      '已确认存在的目录',
      (dir) => {
        const contents = facts.filesystem.directoryContents.get(dir);
        if (contents && contents.length > 0) {
          return `- ${dir}/ (包含: ${contents.slice(0, DIRECTORY_CONTENT_PREVIEW_LIMIT).join(', ')}${
            contents.length > DIRECTORY_CONTENT_PREVIEW_LIMIT ? '...' : ''
          })`;
        }
        return `- ${dir}/`;
      },
    );
  }

  if (facts.filesystem.nonExistentPaths.size > 0) {
    parts.push('\n### 已确认不存在的路径:');
    pushBudgetedPathSection(
      parts,
      facts.filesystem.nonExistentPaths,
      NON_EXISTENT_PATH_DISPLAY_LIMIT,
      '已确认不存在的路径',
      (path) => `- ${path}`,
    );
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run packages/core/src/context/fact-serializer.test.ts`
Expected: PASS (all tests, including the pre-existing budget test).

Also run the sibling context tests to catch regressions:
`pnpm vitest run packages/core/src/context/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/context/fact-serializer.ts packages/core/src/context/fact-serializer.test.ts
git commit -m "perf(core): cap filesystem path lists in fact serializer LLM output"
```

---

### Task 2: Measure token growth for the PR description (optional evidence, cheap)

**Files:** none committed — throwaway script output only.

- [ ] **Step 1: Measure serialized size before/after with an exploration-heavy fact set**

Run a one-off node script (not committed) that builds a `ProjectFacts` object with 500 existing files, 120 directories, and 80 non-existent paths, serializes it with the new code, and prints `text.length` and approximate tokens (`length / 4` for ASCII paths). Compare against the unbounded behavior (computed analytically: ~entries × average line length).

Expected: the capped output stays constant (~65 path lines) regardless of fact growth; record the before/after numbers for the PR body.

---

### Task 3: Quality gates and PR

- [ ] **Step 1: Run `pnpm quality:precommit`** — expected PASS.
- [ ] **Step 2: Run GitNexus `detect_changes`** — verify only `serializeProjectFactsForLLM` and the new helper are affected.
- [ ] **Step 3: Push branch and open PR to `develop`** using the repo PR template, with `Closes #277` and the token-growth numbers from Task 2.
