# Clean LLMService Biome Warning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the remaining `noExplicitAny` warning in `packages/core/src/llm/llm-service.test.ts` without changing LLMService behavior.

**Architecture:** Keep the change test-local. Replace the broad `as any` schema test double with a structural type that satisfies `z.ZodType<T>` for the backend delegation call.

**Tech Stack:** TypeScript, Vitest, Biome, GitNexus, pnpm.

---

### Task 1: Type the LLMService test schema double

**Files:**
- Modify: `packages/core/src/llm/llm-service.test.ts`
- Verify: `docs/superpowers/plans/2026-06-08-clean-llmservice-biome-warning.md`

- [x] **Step 1: Run GitNexus impact analysis before editing**

Run:

```bash
npx gitnexus impact generateObject --direction upstream --file packages/core/src/llm/llm-service.ts --kind Method --include-tests --repo <worktree>
```

Expected: report the blast radius. This issue edits only the test's local schema double, so production call behavior should remain unchanged.

- [x] **Step 2: Replace the explicit-any cast**

In `packages/core/src/llm/llm-service.test.ts`, import the Zod type and replace:

```ts
import type { LLMConfig } from '../types.js';
```

with:

```ts
import type { z } from 'zod';
import type { LLMConfig } from '../types.js';
```

Then replace:

```ts
const schema = { parse: (v: unknown) => v } as any;
```

with:

```ts
const schema: z.ZodType<{ result: string }> = {
  parse: (v: unknown) => v as { result: string },
} as z.ZodType<{ result: string }>;
```

- [x] **Step 3: Run focused lint and tests**

Run:

```bash
pnpm biome check packages/core/src/llm/llm-service.test.ts
pnpm --filter @frontagent/core test -- src/llm/llm-service.test.ts
```

Expected: Biome reports no `noExplicitAny` warning for the file, and the focused LLMService tests pass.

Actual: `pnpm biome check packages/core/src/llm/llm-service.test.ts` passed. The focused test required building fresh-worktree dependencies first (`@frontagent/shared`, `@frontagent/sdd`, and `@frontagent/hallucination-guard`), then `pnpm --filter @frontagent/core test -- src/llm/llm-service.test.ts` passed with 18 tests.

- [x] **Step 4: Run broader verification and diff impact**

Run:

```bash
pnpm lint
pnpm quality:precommit
npx gitnexus detect_changes --scope all -r <worktree>
```

Expected: checks pass; changed files are limited to `packages/core/src/llm/llm-service.test.ts` and this plan, excluding generated `.gitnexus/*` drift.

Actual: `pnpm lint` and `pnpm quality:precommit` passed. After correcting this isolated worktree's private `core.worktree` Git metadata and refreshing GitNexus, `npx gitnexus detect_changes --scope all -r <worktree>` reported 2 changed files, 1 changed test-local `parse` symbol, 0 affected processes, low risk.
