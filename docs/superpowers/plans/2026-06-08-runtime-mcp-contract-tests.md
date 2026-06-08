# Runtime MCP Contract Tests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add focused contract tests for the runtime MCP server tool list, schemas, and one read-only dispatch path for Issue #174.

**Architecture:** Keep production runtime code unchanged. Add a Vitest file beside `mcp-server.ts` that mocks expensive core/runtime behavior and calls the MCP SDK server's registered request handlers directly as a protocol contract seam.

**Tech Stack:** TypeScript, Vitest, `@modelcontextprotocol/sdk`, FrontAgent runtime-node package.

---

### Task 1: Runtime MCP Server Contract Tests

**Files:**
- Create: `packages/runtime-node/src/mcp-server.test.ts`
- Modify: none expected in production code

- [ ] **Step 1: Write focused tests**

Create `packages/runtime-node/src/mcp-server.test.ts` that:
- Uses the MCP SDK server's registered request handler map to exercise `tools/list` and `tools/call` without starting stdio.
- Mocks `@frontagent/core` so `SkillLab.listSkills()` is cheap and deterministic, and LLM service construction does not perform network work.
- Imports `createFrontAgentMcpServer` after mocks are registered.
- Asserts `tools/list` exposes exactly the six public tools named in README and their required schema fields.
- Calls the `tools/call` handler for `frontagent_list_skills`, parses the text result JSON, and asserts it returns project root, root source, and mocked skill metadata without invoking expensive run/plan paths.

- [ ] **Step 2: Verify RED**

Run:

```bash
pnpm --dir packages/runtime-node test -- mcp-server.test.ts
```

Expected before the test file exists or before implementation is complete: fail because no matching test exists or assertions cannot pass.

- [ ] **Step 3: Keep implementation minimal**

No production implementation change should be needed. If the tests reveal the current MCP contract is inaccessible without starting stdio, prefer test-only seams over exporting private helpers.

- [ ] **Step 4: Verify GREEN**

Run:

```bash
pnpm --dir packages/runtime-node test -- mcp-server.test.ts
pnpm --dir packages/runtime-node test
pnpm typecheck
```

Expected: all focused runtime-node tests and monorepo typecheck pass. If GitNexus/precommit gates fail because `npx gitnexus analyze` cannot import `tree-sitter-swift`, record the exact failure in PR verification.

- [ ] **Step 5: Finish branch**

Run GitNexus `detect-changes` if available. Commit only the plan and test file, push `improve/add-runtime-mcp-contract-tests`, create a PR to `develop` with `Closes #174`, impact summary, and verification output.
