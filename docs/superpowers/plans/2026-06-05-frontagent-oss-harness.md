# FrontAgent OSS Harness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a lightweight open-source repository Harness for FrontAgent, adapted from `code-tape` without training-camp claim, score, progress, timeout, or auto-merge workflows.

**Architecture:** Add a small Harness layer around the existing pnpm/Turbo monorepo: local quality scripts, real git hooks, GitNexus contract scripts, OSS contributor docs, PR/Issue templates, CODEOWNERS, contract guard CI, and tests for the Harness itself.

**Tech Stack:** pnpm, Turbo, Biome, Vitest package tests, Node.js ESM workflow scripts, GitHub Actions, GitNexus.

---

## File Structure

- Modify `package.json`: add Harness scripts while preserving existing build, lint, typecheck, test, benchmark, and publish scripts.
- Create `scripts/workflows/install-hooks.mjs`: configure `core.hooksPath=.githooks` and verify hook files exist.
- Create `scripts/workflows/contract-rules.mjs`: classify critical skeleton changes and validate structured GitNexus impact summaries.
- Create `scripts/workflows/contract-check.mjs`: run bootstrap/local/CI GitNexus contract modes.
- Create `scripts/tests/workflow-rules.test.mjs`: node test coverage for contract rules, scripts, hooks, templates, and workflow invariants.
- Create `.githooks/pre-commit` and `.githooks/pre-push`: run local quality gates with `SKIP_QUALITY_HOOKS=1` bypass.
- Modify `.github/workflows/ci.yml`: call `pnpm quality:ci`.
- Create `.github/workflows/contract-guard.yml`: enforce GitNexus contract on PRs to `develop`.
- Create `.github/PULL_REQUEST_TEMPLATE.md`: structured OSS PR self-check.
- Create `.github/ISSUE_TEMPLATE/bug.yml`, `.github/ISSUE_TEMPLATE/feature.yml`, `.github/ISSUE_TEMPLATE/maintenance.yml`, and `.github/ISSUE_TEMPLATE/config.yml`: OSS issue templates.
- Create `.github/CODEOWNERS`: maintainer review requests for Harness and critical surfaces.
- Create `CONTRIBUTING.md`: contributor-facing setup, workflow, quality gates, and PR expectations.
- Create `docs/workflow.md`: maintainer/agent OSS workflow.
- Create `docs/knowledge-contract.md`: GitNexus contract and critical skeleton policy.
- Modify `AGENTS.md` and `CLAUDE.md`: add operational Harness instructions around the GitNexus block.

## Task 1: Add Workflow Contract Scripts

**Files:**
- Create: `scripts/workflows/install-hooks.mjs`
- Create: `scripts/workflows/contract-rules.mjs`
- Create: `scripts/workflows/contract-check.mjs`
- Create: `scripts/tests/workflow-rules.test.mjs`

- [ ] **Step 1: Add hook installer**

Create `scripts/workflows/install-hooks.mjs`:

```js
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const requiredHooks = ['.githooks/pre-commit', '.githooks/pre-push'];

if (process.env.CI) {
  console.log('Skipping git hook installation in CI.');
  process.exit(0);
}

for (const hook of requiredHooks) {
  if (!existsSync(hook)) {
    throw new Error(`missing required git hook: ${hook}`);
  }
}

execFileSync('git', ['config', 'core.hooksPath', '.githooks'], { stdio: 'inherit' });
console.log('Git hooks installed via core.hooksPath=.githooks');
```

- [ ] **Step 2: Add contract rules**

Create `scripts/workflows/contract-rules.mjs` with critical path categories from the design:

```js
export const CONTRACT_DIFF_FILTER = 'ACDMRTUXB';

export const criticalContractRules = [
  {
    category: 'agent-core',
    testPattern: /^packages\/core\/src\/.*\.test\.tsx?$/u,
    matches: (file) =>
      file.startsWith('packages/core/src/agent/') ||
      file === 'packages/core/src/planner.ts' ||
      file === 'packages/core/src/executor.ts',
  },
  {
    category: 'sdd-workflow',
    testPattern: /^packages\/sdd\/src\/.*\.test\.ts$/u,
    matches: (file) =>
      file.startsWith('packages/sdd/src/') ||
      file === 'docs/design.md' ||
      file === 'docs/architecture.md',
  },
  {
    category: 'mcp-boundary',
    testPattern: /^(packages\/mcp-[^/]+|packages\/runtime-node)\/src\/.*\.test\.ts$/u,
    matches: (file) =>
      /^packages\/mcp-[^/]+\/src\//u.test(file) || file.startsWith('packages/runtime-node/src/'),
  },
  {
    category: 'memory-boundary',
    testPattern: /^(packages\/mcp-memory\/src|packages\/core\/src\/memory)\/.*\.test\.ts$/u,
    matches: (file) =>
      file.startsWith('packages/mcp-memory/src/') || file.startsWith('packages/core/src/memory/'),
  },
  {
    category: 'repo-harness',
    testPattern: /^scripts\/tests\//u,
    matches: (file) =>
      file.startsWith('.github/workflows/') ||
      file.startsWith('.github/ISSUE_TEMPLATE/') ||
      file === '.github/PULL_REQUEST_TEMPLATE.md' ||
      file === '.github/CODEOWNERS' ||
      file.startsWith('.githooks/') ||
      file.startsWith('scripts/workflows/'),
  },
  {
    category: 'authority-docs',
    testPattern: /^scripts\/tests\//u,
    matches: (file) =>
      [
        'README.md',
        'AGENTS.md',
        'CLAUDE.md',
        'CONTRIBUTING.md',
        'docs/workflow.md',
        'docs/knowledge-contract.md',
      ].includes(file),
  },
];
```

Also implement `classifyContractPaths(files)`, `combineChangedFiles(changedFiles, untrackedFiles)`, `extractImpactSummary(text)`, and `evaluateGitNexusContract({ changedFiles, impactSummary })`.

- [ ] **Step 3: Add contract check command**

Create `scripts/workflows/contract-check.mjs` with these modes:

- `bootstrap`: runs hook installer and prints required contributor/agent workflow.
- `local`: runs GitNexus analyze then evaluates current changed and untracked files.
- `gitnexus`: runs GitNexus analyze then evaluates PR changed files against `GITNEXUS_IMPACT_SUMMARY`.
- `check`: chooses CI or local mode.

Use `npx --yes --prefer-offline gitnexus analyze --force --index-only` and support `GITNEXUS_ANALYZE_TIMEOUT_MS`.

- [ ] **Step 4: Add workflow tests**

Create `scripts/tests/workflow-rules.test.mjs` with node `test` assertions for:

- Critical repo Harness changes require `scripts/tests/` and a structured impact summary.
- Non-critical docs or package changes pass with advisory warnings.
- Placeholder impact summaries fail for critical changes.
- Impact summaries must include `Risk level`, `Critical skeleton changes`, `GitNexus impact`, and `Verification`.
- `GitNexus impact` must mention `detect_changes` and one of `query`, `context`, or `impact`.
- Required hook files exist and reference `pnpm quality:precommit` / `pnpm quality:local`.
- `package.json` contains required Harness scripts.
- CI targets `develop` and calls `pnpm quality:ci`.
- `contract-guard.yml` targets `develop` and calls `pnpm contract:gitnexus`.
- PR template contains `GitNexus Impact Summary`.

- [ ] **Step 5: Run focused workflow tests**

Run:

```bash
node --test scripts/tests/workflow-rules.test.mjs
```

Expected: tests fail until later tasks create the hook, package, workflow, and template files.

## Task 2: Add Local Gate Scripts And Hooks

**Files:**
- Modify: `package.json`
- Create: `.githooks/pre-commit`
- Create: `.githooks/pre-push`

- [ ] **Step 1: Add root scripts**

Update root `package.json` scripts:

```json
{
  "prepare": "pnpm hooks:install",
  "hooks:install": "node scripts/workflows/install-hooks.mjs",
  "agent:bootstrap": "node scripts/workflows/contract-check.mjs bootstrap",
  "contract:local": "node scripts/workflows/contract-check.mjs local",
  "contract:check": "node scripts/workflows/contract-check.mjs check",
  "contract:gitnexus": "node scripts/workflows/contract-check.mjs gitnexus",
  "quality:predev": "pnpm hooks:install && pnpm contract:local",
  "test:workflows": "node --test scripts/tests/*.test.mjs",
  "quality:precommit": "pnpm lint && pnpm typecheck && pnpm test && pnpm test:workflows",
  "quality:ci": "pnpm lint && pnpm typecheck && pnpm test && pnpm test:workflows && pnpm build",
  "quality:local": "pnpm contract:local && pnpm quality:ci"
}
```

- [ ] **Step 2: Add pre-commit hook**

Create `.githooks/pre-commit`:

```sh
#!/bin/sh
set -eu

if [ "${SKIP_QUALITY_HOOKS:-}" = "1" ]; then
  echo "Skipping pre-commit quality gate because SKIP_QUALITY_HOOKS=1. CI remains authoritative."
  exit 0
fi

pnpm quality:precommit
```

- [ ] **Step 3: Add pre-push hook**

Create `.githooks/pre-push`:

```sh
#!/bin/sh
set -eu

if [ "${SKIP_QUALITY_HOOKS:-}" = "1" ]; then
  echo "Skipping pre-push quality gate because SKIP_QUALITY_HOOKS=1. CI remains authoritative."
  exit 0
fi

pnpm quality:local
```

- [ ] **Step 4: Make hooks executable**

Run:

```bash
chmod +x .githooks/pre-commit .githooks/pre-push
```

- [ ] **Step 5: Verify hook installer**

Run:

```bash
pnpm hooks:install
git config --get core.hooksPath
```

Expected: `.githooks`.

## Task 3: Add OSS Templates And Ownership

**Files:**
- Create: `.github/PULL_REQUEST_TEMPLATE.md`
- Create: `.github/ISSUE_TEMPLATE/bug.yml`
- Create: `.github/ISSUE_TEMPLATE/feature.yml`
- Create: `.github/ISSUE_TEMPLATE/maintenance.yml`
- Create: `.github/ISSUE_TEMPLATE/config.yml`
- Create: `.github/CODEOWNERS`

- [ ] **Step 1: Add PR template**

Create `.github/PULL_REQUEST_TEMPLATE.md` with these headings:

- `## Linked Issue Or Context`
- `## Summary`
- `## Impact Scope`
- `## GitNexus Impact Summary`
- `## Verification`
- `## Checklist`

The impact summary fields must exactly match the contract rules:

```md
- Risk level: -
- Critical skeleton changes: -
- GitNexus impact: -
- Verification: -
```

- [ ] **Step 2: Add issue templates**

Create bug, feature, and maintenance issue forms with required fields for context, affected area, expected behavior or verification, and contributor intent.

- [ ] **Step 3: Add CODEOWNERS**

Create `.github/CODEOWNERS` with owner `@ceilf6` for Harness and critical files listed in the design.

## Task 4: Add OSS Docs And Agent Instructions

**Files:**
- Create: `CONTRIBUTING.md`
- Create: `docs/workflow.md`
- Create: `docs/knowledge-contract.md`
- Modify: `AGENTS.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add CONTRIBUTING**

Document:

- pnpm install/setup.
- `pnpm agent:bootstrap`.
- `pnpm quality:predev` before work.
- `pnpm quality:precommit` before local commits if hooks are unavailable.
- `pnpm quality:local` before push.
- PR template expectations.
- GitNexus impact summary for critical skeleton changes.
- Security and fork workflow notes.

- [ ] **Step 2: Add workflow doc**

Create `docs/workflow.md` with the OSS loop from the design, maintainer triage, branch naming, review expectations, and no training-camp automation.

- [ ] **Step 3: Add knowledge contract**

Create `docs/knowledge-contract.md` with critical categories, summary fields, local/CI behavior, and examples.

- [ ] **Step 4: Update AGENTS and CLAUDE**

Add operational sections before or after the existing GitNexus block:

- Documents and authority priority.
- Required commands before work.
- Rule to ask maintainers if docs conflict.
- Critical skeleton impact summary requirements.
- Explicit OSS note: no claim/score/progress/auto-merge workflow.

## Task 5: Add CI Contract Guard And Align CI

**Files:**
- Modify: `.github/workflows/ci.yml`
- Create: `.github/workflows/contract-guard.yml`

- [ ] **Step 1: Align CI**

Replace individual lint/typecheck/test/build steps in `.github/workflows/ci.yml` with:

```yaml
- name: Quality
  run: pnpm quality:ci
```

Keep the existing Node 20/22 matrix and `develop` branch targets.

- [ ] **Step 2: Add contract guard**

Create `.github/workflows/contract-guard.yml`:

```yaml
name: Contract Guard

on:
  pull_request:
    branches: [develop]
    types: [opened, edited, synchronize, reopened, ready_for_review]

permissions:
  contents: read

concurrency:
  group: contract-guard-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}

jobs:
  gitnexus-contract:
    name: Contract Guard / gitnexus-contract
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 0
      - uses: pnpm/action-setup@v6
      - uses: actions/setup-node@v6
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm contract:gitnexus
        env:
          GITNEXUS_IMPACT_SUMMARY: ${{ github.event.pull_request.body }}
```

## Task 6: Verify And Inspect Impact

**Files:**
- All created/modified Harness files.

- [ ] **Step 1: Run focused Harness tests**

Run:

```bash
node --test scripts/tests/workflow-rules.test.mjs
```

Expected: PASS.

- [ ] **Step 2: Run precommit quality gate**

Run:

```bash
pnpm quality:precommit
```

Expected: PASS, or capture exact failing package/test if existing repo state fails.

- [ ] **Step 3: Run contract check**

Run:

```bash
GITNEXUS_IMPACT_SUMMARY="$(cat .github/PULL_REQUEST_TEMPLATE.md)" pnpm contract:check
```

Expected: PASS only if the PR template fields have been filled for current critical changes. If it fails because the template contains placeholders, rerun with a concrete local summary string to verify the contract parser path.

- [ ] **Step 4: Run GitNexus detect changes**

Run GitNexus detect changes for all current changes and inspect affected flows.

Expected: changed surfaces align with Harness scripts, docs, workflows, templates, and agent instructions.

- [ ] **Step 5: Final static checks**

Run:

```bash
git status --short
git diff --stat
```

Expected: only intended Harness files plus GitNexus index refresh changes are present.
