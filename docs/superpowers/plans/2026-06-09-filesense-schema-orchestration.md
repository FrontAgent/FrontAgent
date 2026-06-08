# Filesense Schema Orchestration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract mcp-filesense schema path/build/write helpers from `engine.ts` into a focused internal module without changing generated schema contents or Filesense indexing/query behavior.

**Architecture:** Keep `engine.ts` as the operation orchestrator and move schema path resolution, relative schema refs, schema builders, and idempotent schema file writes into `packages/mcp-filesense/src/engine-schema.ts`. Engine callers continue to ask for schema paths and refs through the helper module, preserving the existing public API and MCP tool contracts.

**Tech Stack:** TypeScript ESM, Node `fs`/`path`, Vitest.

---

## GitNexus Impact Summary

- `ensureSchemaFiles`: LOW risk, 3 direct callers (`init`, `syncIndexes`, `summarize`), 2 affected processes (`handleFilesenseTool`, `summarize`).
- `buildIndexSchema`: LOW risk, direct caller `ensureSchemaFiles`, same affected processes.
- `buildNotesSchema`: LOW risk, direct caller `ensureSchemaFiles`, same affected processes.
- `schemaPathsForRoot`: HIGH risk, 4 direct callers (`ensureSchemaFiles`, `writeDirectoryIndex`, `summarize`, `check`), indirectly affects `init`, `syncIndexes`, `syncAndSummarize`, `handleFilesenseTool`, and `engine.test.ts`. User authorized continuing; tests must lock paths and generated contents.

## Files

- Create: `packages/mcp-filesense/src/engine-schema.ts`
- Modify: `packages/mcp-filesense/src/engine.ts`
- Modify: `packages/mcp-filesense/src/engine.test.ts`

### Task 1: Lock Generated Schema Behavior

- [ ] Add a focused Vitest case in `engine.test.ts` that initializes a custom `schemaDir`, then asserts:
  - `custom-schemas/FILES.schema.json` and `custom-schemas/FILES.notes.schema.json` exist.
  - Root `FILES.json.$schema` points to `custom-schemas/FILES.schema.json`.
  - Nested `FILES.json.$schema` points to `../custom-schemas/FILES.schema.json`.
  - Root `FILES.notes.json.$schema` points to `custom-schemas/FILES.notes.schema.json`.
  - Schema `$id`, `title`, required fields, and notes properties remain unchanged.
- [ ] Run the focused test before implementation and confirm the new extraction-facing assertions fail or establish the current behavior baseline.

### Task 2: Extract Schema Helpers

- [ ] Move schema helper code from `engine.ts` to `engine-schema.ts`:
  - `schemaPathsForRoot`
  - `relativeSchemaRef`
  - `ensureSchemaFiles`
  - `buildIndexSchema`
  - `buildNotesSchema`
- [ ] Pass small dependencies into `ensureSchemaFiles` (`exists`, `readJson`, `writeJson`, `stableStringify`) so file IO behavior remains owned by `engine.ts`.
- [ ] Export only helpers needed by `engine.ts`.

### Task 3: Rewire Engine Orchestration

- [ ] Import `ensureSchemaFiles`, `relativeSchemaRef`, and `schemaPathsForRoot` from `engine-schema.ts`.
- [ ] Replace local helper calls without changing `init`, `syncIndexes`, `summarize`, `check`, `query`, indexing, or MCP tool output behavior.
- [ ] Remove the old schema helper definitions from `engine.ts`.

### Task 4: Verify

- [ ] Run focused tests: `pnpm --filter @frontagent/mcp-filesense test -- engine.test.ts`.
- [ ] Run package typecheck: `pnpm --filter @frontagent/mcp-filesense typecheck`.
- [ ] Run repository gate: `pnpm quality:precommit`.
- [ ] Run GitNexus final diff analysis: `npx gitnexus detect-changes --scope all --repo <worktree-path>`.
- [ ] Include `Closes #244` and the GitNexus impact summary in the PR body.
