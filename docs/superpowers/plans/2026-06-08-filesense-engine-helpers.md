# Filesense Engine Helpers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract filesense scoring and directory inference helper logic from `engine.ts` without changing public filesense behavior.

**Architecture:** Keep filesystem and MCP-facing engine operations in `packages/mcp-filesense/src/engine.ts`. Move pure helper logic into `packages/mcp-filesense/src/engine-helpers.ts` so scoring and index-derived inference can be tested without creating workspaces.

**Tech Stack:** TypeScript, Vitest, existing `@frontagent/mcp-filesense` package scripts.

---

### Task 1: Helper Module Extraction

**Files:**
- Create: `packages/mcp-filesense/src/engine-helpers.ts`
- Create: `packages/mcp-filesense/src/engine-helpers.test.ts`
- Modify: `packages/mcp-filesense/src/engine.ts`

- [ ] **Step 1: Write failing helper tests**

Add focused tests proving current helper behavior:

```ts
import { describe, expect, it } from 'vitest';
import {
  inferDirectoryPurpose,
  inferImportance,
  scoreCandidate,
} from './engine-helpers.js';
```

Cover high-importance entrypoint/config names, known directory purposes, content-derived directory purposes, and navigate candidate score ordering.

- [ ] **Step 2: Verify tests fail before implementation**

Run: `pnpm --filter @frontagent/mcp-filesense test -- engine-helpers.test.ts`

Expected: FAIL because `./engine-helpers.js` does not exist.

- [ ] **Step 3: Extract pure helpers**

Move `inferImportance`, `inferDirectoryPurpose`, and `scoreCandidate` unchanged into `engine-helpers.ts`, export them, and import them from `engine.ts`.

- [ ] **Step 4: Verify focused package behavior**

Run:

```bash
pnpm --filter @frontagent/mcp-filesense test -- engine-helpers.test.ts
pnpm --filter @frontagent/mcp-filesense test
pnpm --filter @frontagent/mcp-filesense typecheck
```

Expected: all commands exit 0.

- [ ] **Step 5: Pre-PR impact and scope checks**

Run:

```bash
npx gitnexus detect-changes --scope all --repo /Users/ceilf6/.config/superpowers/worktrees/FrontAgent-app/issue185-extract-filesense-engine-helpers
git diff --stat origin/develop...HEAD
```

Expected: changed symbols are limited to filesense engine/helper/test and this plan.
