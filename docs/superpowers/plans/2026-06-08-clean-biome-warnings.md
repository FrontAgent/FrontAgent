# Clean Biome Warnings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the existing Biome warnings in the executor and shared test files owned by issue #186.

**Architecture:** Keep the change test-only by replacing broad `as any` casts with typed fixtures and helpers. Preserve the `escapeRegex` metacharacter assertion while avoiding Biome's template-placeholder string warning.

**Tech Stack:** TypeScript, Vitest, Biome, pnpm, GitNexus CLI.

---

### Task 1: Replace Executor Test `as any` Casts

**Files:**
- Modify: `packages/core/src/executor/executor.test.ts`

- [ ] **Step 1: Confirm lint baseline**

Run:

```bash
pnpm biome check packages/core/src/executor/executor.test.ts packages/shared/src/utils.test.ts
```

Expected: Biome reports `lint/suspicious/noExplicitAny` warnings in `executor.test.ts` and `lint/suspicious/noTemplateCurlyInString` in `utils.test.ts`.

- [ ] **Step 2: Add typed fixtures**

Update `executor.test.ts` to import the relevant types and use helpers for `ExecutorConfig`, `ExecutorActionSkill`, `AgentTask`, and executor context objects. Keep runtime fixtures source-local; use `unknown`-based casts only where class-private fields prevent structural test doubles for `ExecutorConfig['hallucinationGuard']` and `ExecutorConfig['llmService']`.

- [ ] **Step 3: Replace repeated inline casts**

Replace repeated inline `{ task, collectedContext } as any` objects with a typed `makeExecutionContext()` helper, and type the action skill fixture as `ExecutorActionSkill`.

### Task 2: Preserve Regex Coverage Without Template Warning

**Files:**
- Modify: `packages/shared/src/utils.test.ts`

- [ ] **Step 1: Fix the metacharacter input literal**

Build the input string without a literal `${}` sequence in a normal string, then keep the same expected escaped output.

### Task 3: Verify And Prepare PR

**Files:**
- Verify: `packages/core/src/executor/executor.test.ts`
- Verify: `packages/shared/src/utils.test.ts`
- Verify: `docs/superpowers/plans/2026-06-08-clean-biome-warnings.md`

- [ ] **Step 1: Run focused lint and tests**

Run:

```bash
pnpm biome check packages/core/src/executor/executor.test.ts packages/shared/src/utils.test.ts
pnpm --filter @frontagent/core test -- src/executor/executor.test.ts
pnpm --filter @frontagent/shared test -- src/utils.test.ts
```

- [ ] **Step 2: Run typecheck and broader gates as feasible**

Run:

```bash
pnpm --filter @frontagent/core typecheck
pnpm --filter @frontagent/shared typecheck
pnpm lint
pnpm quality:precommit
```

- [ ] **Step 3: Run GitNexus diff inspection**

Run:

```bash
npx gitnexus detect_changes --scope all -r /Users/ceilf6/.config/superpowers/worktrees/FrontAgent-app/improve-clean-biome-warnings
```

Expected: Changed files are limited to the two scoped tests and this plan.
