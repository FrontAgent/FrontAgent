# Split Code Quality SubAgent Prompt Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the `CodeQualitySubAgent` LLM prompt-building boundary into a focused helper module while preserving review behavior and public exports.

**Architecture:** Keep `CodeQualitySubAgent` responsible for A2A handling, LLM invocation, issue merging, rule fallback, and fact updates. Move only prompt payload assembly, SDD summary formatting, shared-facts summary formatting, and per-file truncation into `code-quality-prompt.ts`, with direct unit tests for the helper.

**Tech Stack:** TypeScript, Vitest, existing `@frontagent/core` source layout.

---

### GitNexus Impact Summary

- `evaluateWithLLM`: LOW risk, direct caller `CodeQualitySubAgent.handleRequest`, affected flow `code-quality-subagent-worker.ts:main`, affected module `Sub-agents`.
- `buildSddSummary`, `summarizeSharedFacts`, `truncateFileContent`: LOW risk, direct caller `evaluateWithLLM`, same worker flow and module.
- `CodeQualitySubAgent` class-level impact query was attempted after re-indexing but the GitNexus CLI could not disambiguate duplicate `FrontAgent` registry entries. Source-backed direct usage shows construction in `packages/core/src/agent/agent.ts` and `packages/core/src/sub-agents/code-quality-subagent-worker.ts`, plus barrel exports from `packages/core/src/index.ts` and `packages/core/src/sub-agents/index.ts`.

### Task 1: Prompt-Building Helper

**Files:**
- Create: `packages/core/src/sub-agents/code-quality-prompt.ts`
- Create: `packages/core/src/sub-agents/code-quality-prompt.test.ts`
- Modify: `packages/core/src/sub-agents/code-quality-subagent.ts`

- [x] **Step 1: Write failing helper tests**

```ts
import { describe, expect, it } from 'vitest';
import { buildCodeQualityLlmReviewPrompt } from './code-quality-prompt.js';
```

Run:

```bash
pnpm --dir packages/core test -- src/sub-agents/code-quality-prompt.test.ts
```

Expected: fail because `code-quality-prompt.js` does not exist.

- [x] **Step 2: Implement the helper module**

Create a helper that exports `buildCodeQualityLlmReviewPrompt(payload, options)` and returns `{ system, userPrompt }`. It must preserve the current prompt strings, file slicing, file truncation marker, SDD summary fields, shared-facts limits, and JSON formatting.

- [x] **Step 3: Wire `CodeQualitySubAgent.evaluateWithLLM` to the helper**

Replace private prompt-building calls in `evaluateWithLLM` with the helper result and remove the obsolete private `buildSddSummary`, `summarizeSharedFacts`, and `truncateFileContent` methods. Replace the production TODO with a concrete note that the first split keeps rule fallback policy local and only extracts LLM prompt policy.

- [x] **Step 4: Verify focused tests**

Run:

```bash
pnpm --dir packages/core test -- src/sub-agents/code-quality-prompt.test.ts
```

Expected: exit 0.

- [x] **Step 5: Verify touched sub-agent behavior and types**

Run:

```bash
pnpm --dir packages/core test -- src/sub-agents/code-quality-prompt.test.ts src/agent/phase-checks.test.ts src/agent/agent.test.ts
pnpm --dir packages/core typecheck
```

Expected: both commands exit 0.

- [x] **Step 6: Final repository checks**

Run:

```bash
pnpm typecheck
pnpm quality:precommit
npx gitnexus detect-changes --scope all
```

Expected: typecheck and precommit exit 0; detect-changes shows only the expected prompt helper, test, plan, and sub-agent changes.
