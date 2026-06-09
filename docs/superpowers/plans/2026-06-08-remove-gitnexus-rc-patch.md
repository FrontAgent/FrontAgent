# Remove GitNexus RC Patch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve Issue #181 by upgrading GitNexus from `1.6.6-rc.159` to stable `1.6.6` and removing the pnpm patch if the stable release preserves the local contract gate.

**Architecture:** Keep the Harness contract scripts unchanged and treat this as dependency metadata cleanup. Update the workflow-rule test so it asserts stable GitNexus is pinned without repository patch metadata, then let `pnpm install` regenerate the lockfile and verify `pnpm quality:predev` proves the stable CLI can still index the repository.

**Tech Stack:** pnpm 9 lockfile metadata, Node.js package manifest, GitNexus CLI, Node test runner.

---

### Task 1: Replace RC GitNexus Patch With Stable Release

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `scripts/tests/workflow-rules.test.mjs`
- Delete: `patches/gitnexus@1.6.6-rc.159.patch`
- Create: `docs/superpowers/plans/2026-06-08-remove-gitnexus-rc-patch.md`

- [ ] **Step 1: Update focused workflow expectation**

Modify the `package exposes required OSS Harness scripts` test in `scripts/tests/workflow-rules.test.mjs` so the GitNexus dependency assertions become:

```js
assert.equal(pkg.devDependencies.gitnexus, '1.6.6');
assert.equal(pkg.pnpm.patchedDependencies, undefined);
```

- [ ] **Step 2: Run focused test and confirm it fails**

Run:

```bash
node --test scripts/tests/workflow-rules.test.mjs
```

Expected: FAIL because `package.json` still pins `1.6.6-rc.159` and still has `pnpm.patchedDependencies`.

- [ ] **Step 3: Upgrade package metadata and regenerate lockfile**

Run:

```bash
pnpm add -D gitnexus@1.6.6
```

Then remove the `pnpm.patchedDependencies` block from `package.json`, delete `patches/gitnexus@1.6.6-rc.159.patch`, and run:

```bash
pnpm install
```

Expected: `pnpm-lock.yaml` no longer contains `patchedDependencies`, `patch_hash=`, `gitnexus@1.6.6-rc.159`, or `patches/gitnexus@1.6.6-rc.159.patch`.

- [ ] **Step 4: Verify stable GitNexus preserves the contract gate**

Run:

```bash
node --test scripts/tests/workflow-rules.test.mjs
pnpm quality:predev
```

Expected: workflow-rule tests pass, and `pnpm quality:predev` completes GitNexus analyze/index using stable `gitnexus@1.6.6`.

- [ ] **Step 5: Fallback only if stable fails**

If `pnpm quality:predev` fails because stable `gitnexus@1.6.6` still has the optional grammar startup issue, restore the smallest possible patch for `gitnexus@1.6.6`, update the test to assert that exact stable patch metadata, and document the failure output in the PR body.

- [ ] **Step 6: Final verification and PR**

Run:

```bash
pnpm quality:precommit
npx gitnexus detect_changes --scope all -r "FrontAgent"
git status --short
```

Expected: precommit passes, GitNexus detect_changes reports only expected dependency/test/plan scope, and staged commit contents exclude generated `.gitnexus/*` drift.

Commit and open the PR:

```bash
git add package.json pnpm-lock.yaml scripts/tests/workflow-rules.test.mjs docs/superpowers/plans/2026-06-08-remove-gitnexus-rc-patch.md patches/gitnexus@1.6.6-rc.159.patch
git commit -m "chore: remove gitnexus rc patch"
git push -u origin improve/remove-gitnexus-rc-patch
gh pr create --base develop --head improve/remove-gitnexus-rc-patch --title "Remove GitNexus RC patch" --body-file <prepared-body>
```

Expected: PR body includes `Closes #181`, issue review score `5/5`, GitNexus impact summary, and verification evidence.
