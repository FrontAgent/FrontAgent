# GitGuardian CI Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an independent GitGuardian secret-scanning GitHub Actions workflow for `develop`.

**Architecture:** Create one standalone workflow under `.github/workflows/` that mirrors the repository's existing `develop` branch policy, grants read-only contents permission, checks out full history, and invokes GitGuardian's official ggshield secret scan action with the existing `GITGUARDIAN_API_KEY` secret.

**Tech Stack:** GitHub Actions YAML, GitGuardian ggshield action, repository secret `GITGUARDIAN_API_KEY`.

---

## File Structure

- Create `.github/workflows/gitguardian.yml`: standalone GitGuardian secret-scanning workflow.
- No source code files change.
- No existing CI workflow changes are required.

## Task 1: Add GitGuardian Workflow

**Files:**
- Create: `.github/workflows/gitguardian.yml`

- [ ] **Step 1: Create the workflow file**

Create `.github/workflows/gitguardian.yml`:

```yaml
name: GitGuardian scan

on:
  push:
    branches: [develop]
  pull_request:
    branches: [develop]

permissions:
  contents: read

concurrency:
  group: gitguardian-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}

jobs:
  scanning:
    name: GitGuardian scan
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v6
        with:
          fetch-depth: 0

      - name: GitGuardian scan
        uses: GitGuardian/ggshield/actions/secret@v1.51.0
        env:
          GITHUB_PUSH_BEFORE_SHA: ${{ github.event.before }}
          GITHUB_PUSH_BASE_SHA: ${{ github.event.base }}
          GITHUB_PULL_BASE_SHA: ${{ github.event.pull_request.base.sha }}
          GITHUB_DEFAULT_BRANCH: ${{ github.event.repository.default_branch }}
          GITGUARDIAN_API_KEY: ${{ secrets.GITGUARDIAN_API_KEY }}
```

- [ ] **Step 2: Inspect the workflow file**

Run:

```bash
sed -n '1,160p' .github/workflows/gitguardian.yml
```

Expected: the file contains `push` and `pull_request` triggers for `develop`, `contents: read`, `fetch-depth: 0`, and `GITGUARDIAN_API_KEY`.

- [ ] **Step 3: Run local precommit quality gate**

Run:

```bash
pnpm quality:precommit
```

Expected: lint, typecheck, tests, and workflow tests pass.

- [ ] **Step 4: Run GitNexus change detection**

Run GitNexus `detect_changes` with `scope: "all"` for `/Users/a86198/FrontAgent`.

Expected: changed scope is limited to the new GitGuardian workflow plus the planning/design documents; no source-code symbols or product execution flows are affected.
