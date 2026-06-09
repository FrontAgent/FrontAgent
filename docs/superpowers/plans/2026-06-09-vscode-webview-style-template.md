# VS Code Webview Style Template Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split `renderWebviewStyleSection` into focused CSS template helpers while preserving the public composer and generated webview styles.

**Architecture:** Keep `apps/vscode/src/webview-html.ts` as the webview renderer module. Add small CSS helpers grouped by responsibility, and keep `renderWebviewStyleSection(styleNonce)` as the exported nonce-wrapping composer that joins those helpers in the existing order.

**Tech Stack:** TypeScript, VS Code webview HTML string rendering, Vitest, GitNexus.

---

## GitNexus Impact

- `npx gitnexus impact -r <worktree> renderWebviewStyleSection --direction upstream`: LOW risk; 0 direct impacted symbols, 0 affected processes, 0 affected modules.
- `npx gitnexus context -r <worktree> renderWebviewStyleSection`: symbol participates in `ResolveWebviewView -> RenderWebviewStyleSection`; incoming references are from `apps/vscode/src/webview-html.test.ts`.
- User authorization covers proceeding even if later impact reports HIGH/CRITICAL; current style composer impact is LOW.

## Files

- Modify: `apps/vscode/src/webview-html.ts`
- Modify: `apps/vscode/src/webview-html.test.ts`
- Create: `docs/superpowers/plans/2026-06-09-vscode-webview-style-template.md`

## Tasks

- [x] Add focused tests in `apps/vscode/src/webview-html.test.ts` that import the new CSS helper exports and assert `renderWebviewStyleSection(styleNonce)` preserves the nonce wrapper and helper output order.
- [x] Run `pnpm --dir apps/vscode test -- src/webview-html.test.ts` and confirm the new helper import test fails before implementation.
- [x] Extract CSS fragments in `apps/vscode/src/webview-html.ts` into helper functions for design tokens/base layout, header/config controls, messages/live output, composer/details, and motion utilities.
- [x] Keep `renderWebviewStyleSection(styleNonce)` exported as the public composer and ensure it joins the helper fragments without changing IDs, classes, CSP nonce handling, webview protocol, or style semantics.
- [x] Run focused tests, typecheck, `pnpm quality:precommit`, and `npx gitnexus detect_changes -r <worktree>` before committing.
- [ ] Open a PR to `develop` with `Closes #240` and a GitNexus Impact Summary, then watch repo-guard comments for up to 5 minutes.

## CSS Equivalence Check

- `node -e <static comparison>` reconstructed the new helper output and compared it to `origin/develop` for nonce `equivalence-nonce`: equal, 11915 bytes, 5 helpers.

## Verification

- `pnpm --dir apps/vscode test -- src/webview-html.test.ts`: passed, 7 tests.
- `pnpm typecheck`: passed through Turbo.
- `pnpm quality:precommit`: passed.
- `npx gitnexus detect_changes -r <worktree>`: MEDIUM risk, 3 files, 2 symbols; affected flows are `ResolveWebviewView -> RenderWebviewStyleSection` and `ResolveWebviewView -> RenderWebviewStateScript`. `renderWebviewStateScript` is adjacent range attribution from line movement; its code body was not changed.
