# Filesense Index Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the `mcp-filesense` directory index persistence decision from `engine.ts` into a focused helper module while preserving public Filesense behavior.

**Architecture:** Keep high-blast-radius traversal and inference helpers in `engine.ts` unchanged. Add `packages/mcp-filesense/src/engine-indexing.ts` for the low-risk index persistence comparison/write path, and call it from the existing `writeDirectoryIndex` function.

**Tech Stack:** TypeScript, Vitest, Node `fs` test workspaces, existing `@frontagent/mcp-filesense` package scripts.

---

## Scope

- Modify: `packages/mcp-filesense/src/engine.ts`
- Create: `packages/mcp-filesense/src/engine-indexing.ts`
- Create: `packages/mcp-filesense/src/engine-indexing.test.ts`
- Keep unchanged: core Agent/Executor/Planner files, MCP tool contracts, navigation behavior, high-impact helpers reported by GitNexus (`relativeToRoot`, `listTrackedEntries`, `inferSummary`, `writeJson`, `stableStringify`).

## GitNexus Pre-Edit Impact

- `init`: LOW, 0 direct dependents.
- `syncIndexes`: LOW, direct dependents are `init`, `syncAndSummarize`, and `handleFilesenseTool`; one affected filesense tool process.
- `writeDirectoryIndex`: LOW, direct caller is `syncIndexes`; affected process is `handleFilesenseTool`.
- `comparableIndex`: LOW, direct caller is `writeDirectoryIndex`.
- Not edited because impact is too broad: `relativeToRoot` CRITICAL; `listTrackedEntries`, `inferSummary`, `writeJson`, and `stableStringify` HIGH.

## Tasks

- [ ] Add a failing focused test in `packages/mcp-filesense/src/engine-indexing.test.ts` for `persistDirectoryIndex` returning `wroteIndex: false` and not calling the writer when the comparable index is unchanged.

Run:

```bash
pnpm --filter @frontagent/mcp-filesense test -- src/engine-indexing.test.ts
```

Expected before implementation: FAIL because `./engine-indexing.js` does not exist.

- [ ] Implement `persistDirectoryIndex` in `packages/mcp-filesense/src/engine-indexing.ts`.

The helper accepts previous index data, next comparable index fields, `forceFull`, `filesHashed`, and an injected writer. It performs the stable comparable-index check, writes `IndexFile` only when needed, and preserves `last_full_sync` semantics.

- [ ] Replace the comparison/write tail of `writeDirectoryIndex` in `packages/mcp-filesense/src/engine.ts` with a call to `persistDirectoryIndex`.

Keep traversal, entry collection, hash reuse, summaries, and path helpers in place. Do not edit `relativeToRoot`, `listTrackedEntries`, `inferSummary`, `writeJson`, or `stableStringify`.

- [ ] Run focused validation.

```bash
pnpm --filter @frontagent/mcp-filesense test -- src/engine-indexing.test.ts src/engine.test.ts
pnpm --filter @frontagent/mcp-filesense typecheck
```

- [ ] Run final repository gates and GitNexus diff inspection.

```bash
pnpm quality:precommit
npx gitnexus detect-changes -r FrontAgent
```
