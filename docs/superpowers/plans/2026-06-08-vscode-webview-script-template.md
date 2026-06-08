# VS Code Webview Script Template Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decompose `renderWebviewScriptSection` so it mainly assembles focused script template fragments while preserving generated webview behavior.

**Architecture:** Keep `apps/vscode/src/webview-html.ts` as the existing renderer module. Add small script-fragment helpers for state/render orchestration, config/mode rendering, context/details rendering, messages, event wiring, and error reporting; `renderWebviewScriptSection` remains the nonce wrapper and assembly point.

**Tech Stack:** TypeScript, VS Code webview HTML string rendering, Vitest.

---

## GitNexus Impact

- `npx gitnexus impact renderWebviewScriptSection --direction upstream --file apps/vscode/src/webview-html.ts --kind Function --include-tests --repo <worktree>`: LOW risk; 1 direct affected symbol, `apps/vscode/src/webview-html.test.ts`; 0 affected processes/modules.
- `npx gitnexus context renderWebviewScriptSection --file apps/vscode/src/webview-html.ts --repo <worktree>`: participates in `ResolveWebviewView -> getWebviewHtml -> renderWebviewScriptSection`.
- `npx gitnexus query "VS Code webview HTML render script section" --repo <worktree> --limit 5`: top process is the VS Code webview render path.

## Files

- Modify: `apps/vscode/src/webview-html.ts`
- Modify: `apps/vscode/src/webview-html.test.ts`

## Tasks

- [x] Add a focused test that imports the new script helper exports and verifies `renderWebviewScriptSection` assembles those helpers in order while keeping the nonce wrapper.
- [x] Run `pnpm --filter frontagent test -- src/webview-html.test.ts` and confirm the test fails because the helper exports do not exist yet.
- [x] Extract script template fragments into focused helper functions in `apps/vscode/src/webview-html.ts`; keep the generated IDs, classes, messages, state fields, UI text, and event handlers unchanged.
- [x] Run `pnpm --filter frontagent test -- src/webview-html.test.ts` and confirm the focused test passes.
- [x] Run `pnpm --filter frontagent typecheck`.
- [x] Run `npx gitnexus detect_changes --scope all --repo <worktree>` and record the final diff impact.
- [x] Run `pnpm quality:precommit` if the diff impact or PR risk warrants the broader gate.

## Final Diff Impact

- `npx gitnexus detect_changes --scope all --repo <worktree>`: MEDIUM risk; 3 files, 2 changed symbols; affected flows are `ResolveWebviewView -> RenderWebviewScriptSection` and `ResolveWebviewView -> RenderWebviewBodySection`.
- `renderWebviewBodySection` is reported because the adjacent script extraction moved the following symbol range; body markup/extraction was not edited.
- After rebasing onto latest `origin/develop`, `npx gitnexus detect_changes --scope compare --base-ref origin/develop --repo <worktree>` reported MEDIUM risk; 3 files, 1 changed indexed symbol; affected flow `ResolveWebviewView -> Nonce`. This is GitNexus range attribution for the webview renderer diff; nonce/CSP behavior was not edited.
- `pnpm quality:precommit`: passed.
