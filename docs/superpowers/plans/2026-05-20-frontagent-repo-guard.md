# FrontAgent Repo Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Repo Guard review automation to FrontAgent for PRs, issues, and manual review comments.

**Architecture:** Keep Repo Guard isolated in its own GitHub Actions workflow so existing CI remains unchanged. Store all model credentials in GitHub repository settings and reference them from workflow inputs.

**Tech Stack:** GitHub Actions YAML, `ceilf6/repo-guard@main`, GitHub CLI, repository secrets and variables.

---

## Task 1: Add Repo Guard Workflow

**Files:**
- Create: `.github/workflows/repo-guard.yml`

- [ ] **Step 1: Create workflow**

Create `.github/workflows/repo-guard.yml`:

```yaml
name: Repo Guard

on:
  pull_request:
    branches: [develop]
    types: [opened, synchronize, reopened, ready_for_review]
  issues:
    types: [opened]
  issue_comment:
    types: [created]

permissions:
  contents: read
  pull-requests: write
  issues: write

jobs:
  guard:
    runs-on: ubuntu-latest
    steps:
      - uses: ceilf6/repo-guard@main
        with:
          type: both
          provider: ${{ vars.LLM_PROVIDER }}
          model: ${{ vars.LLM_MODEL }}
          api-key: ${{ secrets.LLM_API_KEY }}
          base-url: ${{ vars.LLM_BASE_URL }}
          language: zh
```

- [ ] **Step 2: Verify no literal credential is present**

Run:

```bash
rg -n "LLM_API_KEY|LLM_PROVIDER|LLM_BASE_URL|LLM_MODEL" .github/workflows/repo-guard.yml
```

Expected: output references `secrets.LLM_API_KEY` and `vars.*`, with no literal API key.

- [ ] **Step 3: Parse YAML with Ruby stdlib**

Run:

```bash
ruby -e 'require "yaml"; YAML.load_file(".github/workflows/repo-guard.yml"); puts "ok"'
```

Expected: `ok`.

## Task 2: Configure GitHub Secret And Variables

**Files:**
- No repository files changed.

- [ ] **Step 1: Set the secret**

Run a command that passes the user-provided key to `gh secret set LLM_API_KEY --repo ceilf6/FrontAgent --body-file -` through stdin. Do not write the key to disk.

- [ ] **Step 2: Set variables**

Run:

```bash
gh variable set LLM_PROVIDER --repo ceilf6/FrontAgent --body anthropic
gh variable set LLM_BASE_URL --repo ceilf6/FrontAgent --body https://token-plan-cn.xiaomimimo.com/anthropic
gh variable set LLM_MODEL --repo ceilf6/FrontAgent --body mimo-v2.5-pro
```

- [ ] **Step 3: Verify settings names**

Run:

```bash
gh secret list --repo ceilf6/FrontAgent
gh variable list --repo ceilf6/FrontAgent
```

Expected: `LLM_API_KEY` appears in the secret list, and all three `LLM_*` variables appear with the expected non-secret values.

## Task 3: Commit And Open PR

**Files:**
- Create: `.github/workflows/repo-guard.yml`
- Create: `docs/superpowers/specs/2026-05-20-frontagent-repo-guard-design.md`
- Create: `docs/superpowers/plans/2026-05-20-frontagent-repo-guard.md`

- [ ] **Step 1: Run GitNexus change detection**

Run:

```bash
git status --short --branch
```

Then run GitNexus detect changes before committing.

- [ ] **Step 2: Commit**

Run:

```bash
git add .github/workflows/repo-guard.yml docs/superpowers/specs/2026-05-20-frontagent-repo-guard-design.md docs/superpowers/plans/2026-05-20-frontagent-repo-guard.md
git commit -m "ci: add repo guard workflow"
```

- [ ] **Step 3: Push and open PR to develop**

Run:

```bash
git push -u origin codex/add-repo-guard-workflow
gh pr create --repo ceilf6/FrontAgent --base develop --head ceilf6:codex/add-repo-guard-workflow --title "ci: add repo guard workflow" --body-file /tmp/frontagent-repo-guard-pr.md
```

Expected: GitHub returns a PR URL targeting `develop`.
