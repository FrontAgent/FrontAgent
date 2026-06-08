# Fix GitNexus Contract Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the local GitNexus contract gate so `pnpm quality:predev` and direct `npx gitnexus analyze --force --index-only` complete locally.

**Architecture:** Use a repository-pinned GitNexus CLI instead of a floating temporary `npx gitnexus` install, because the published `gitnexus@1.6.6` dependency tree currently fails during npm resolution or parser module loading. Keep the contract script behavior the same, but add GitNexus's documented WAL checkpoint threshold argument so local analyze avoids the checkpoint rotation failure observed with the working RC.

**Tech Stack:** Node.js ESM workflow scripts, pnpm, npm/npx, GitNexus CLI, Node test runner.

---

### Task 1: Pin GitNexus CLI And Harden Analyze Invocation

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `scripts/workflows/contract-check.mjs`
- Modify: `scripts/tests/workflow-rules.test.mjs`
- Create: `patches/gitnexus@1.6.6-rc.159.patch`

- [ ] **Step 1: Add focused workflow tests**

Update `scripts/tests/workflow-rules.test.mjs` so the existing analyze invocation test asserts that the script streams output and includes the WAL threshold argument:

```js
assert.match(
  analyzeFunction,
  /spawnSync\(command, args, \{\s*stdio: 'inherit',\s*timeout: timeoutMs,\s*\}\)/u,
);
assert.match(contractCheck, /'--wal-checkpoint-threshold'/u);
assert.match(contractCheck, /GITNEXUS_WAL_CHECKPOINT_THRESHOLD = '67108864'/u);
```

Also extend the package script exposure test with:

```js
assert.match(pkg.devDependencies.gitnexus, /^1\.6\.6-rc\./u);
```

- [ ] **Step 2: Run focused test and confirm it fails**

Run:

```bash
node --test scripts/tests/workflow-rules.test.mjs
```

Expected: FAIL because `package.json` has no `devDependencies.gitnexus`, and `getGitNexusAnalyzeInvocation()` does not include `--wal-checkpoint-threshold`.

- [ ] **Step 3: Implement minimal script/package fix**

Modify `package.json`:

```json
"devDependencies": {
  "gitnexus": "1.6.6-rc.159"
},
"pnpm": {
  "patchedDependencies": {
    "gitnexus@1.6.6-rc.159": "patches/gitnexus@1.6.6-rc.159.patch"
  }
}
```

Preserve existing devDependencies and ordering style.

Modify `scripts/workflows/contract-check.mjs`:

```js
const GITNEXUS_WAL_CHECKPOINT_THRESHOLD = '67108864';

function getGitNexusAnalyzeInvocation() {
  const args = [
    '--yes',
    '--prefer-offline',
    'gitnexus',
    'analyze',
    '--force',
    '--index-only',
    '--wal-checkpoint-threshold',
    GITNEXUS_WAL_CHECKPOINT_THRESHOLD,
  ];
  if (process.platform === 'win32') {
    return { command: 'cmd.exe', args: ['/d', '/s', '/c', 'npx.cmd', ...args] };
  }
  return { command: 'npx', args };
}
```

- [ ] **Step 4: Patch optional GitNexus parser modules**

Create `patches/gitnexus@1.6.6-rc.159.patch` with a pnpm patch that lazy-loads the optional Dart, Kotlin, and Swift tree-sitter grammars with `createRequire()`. This prevents repositories that do not index those languages from failing during module graph initialization when an optional grammar package is absent.

- [ ] **Step 5: Install dependencies and update lockfile**

Run:

```bash
pnpm install
```

Expected: `node_modules` is installed and `pnpm-lock.yaml` records the pinned GitNexus CLI.

- [ ] **Step 6: Verify focused workflow coverage**

Run:

```bash
node --test scripts/tests/workflow-rules.test.mjs
```

Expected: all workflow rule tests pass.

### Task 2: Contract Gate Verification And PR Prep

**Files:**
- Verify: `package.json`
- Verify: `pnpm-lock.yaml`
- Verify: `scripts/workflows/contract-check.mjs`
- Verify: `scripts/tests/workflow-rules.test.mjs`
- Verify: `patches/gitnexus@1.6.6-rc.159.patch`

- [ ] **Step 1: Run required issue verification commands**

Run:

```bash
pnpm agent:bootstrap
pnpm quality:predev
npx gitnexus analyze --force --index-only
npx gitnexus query -r "FrontAgent" "unused exports dead code unreachable" --limit 5
```

Expected: all commands complete. If GitNexus generates `.gitnexus/*` drift, inspect it and do not commit it unless required for this fix.

- [ ] **Step 2: Run broader local gates**

Run:

```bash
pnpm quality:precommit
```

Expected: lint, typecheck, tests, and workflow tests pass.

- [ ] **Step 3: Inspect final GitNexus diff impact**

Run:

```bash
npx gitnexus detect_changes --scope all -r "FrontAgent"
```

Expected: affected files are limited to the repo harness script, workflow test, package manifest, lockfile, and this plan.

- [ ] **Step 4: Commit and open PR**

Run:

```bash
git add package.json pnpm-lock.yaml scripts/workflows/contract-check.mjs scripts/tests/workflow-rules.test.mjs patches/gitnexus@1.6.6-rc.159.patch docs/superpowers/plans/2026-06-08-fix-gitnexus-contract-gate.md
git commit -m "fix: restore local gitnexus contract gate"
git push -u origin improve/fix-gitnexus-contract-gate
gh pr create --base develop --head improve/fix-gitnexus-contract-gate --title "Fix GitNexus local contract gate" --body-file <prepared-body>
```

Expected: PR body includes `Closes #171`, GitNexus impact summary, and verification evidence.
