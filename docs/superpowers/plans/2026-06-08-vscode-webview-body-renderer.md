# VS Code Webview Body Renderer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve Issue #223 by extracting the VS Code webview body markup from `getWebviewHtml` without changing generated HTML, CSP nonce behavior, message protocol, state behavior, IDs, classes, or UI copy.

**Architecture:** Keep `getWebviewHtml(webview)` as the public document renderer that owns nonce generation, CSP construction, `<head>`, style section insertion, script section insertion, and final document assembly. Add `renderWebviewBodySection()` beside the existing style and script renderers; the new helper returns only the existing `.shell` body markup so future body changes can be reviewed independently.

**Tech Stack:** TypeScript, VS Code webview HTML, Vitest, GitNexus CLI.

---

### Task 1: Add the Body Renderer Contract Test

**Files:**
- Modify: `apps/vscode/src/webview-html.test.ts`
- Read: `apps/vscode/src/webview-html.ts`

**GitNexus impact before code edits:** `npx gitnexus impact getWebviewHtml --direction upstream --file apps/vscode/src/webview-html.ts --kind Function --include-tests --repo /Users/ceilf6/.config/superpowers/worktrees/FrontAgent-app/improve-vscode-webview-body-renderer` reported LOW risk, 1 direct dependent (`apps/vscode/src/webview-html.test.ts`), and 0 affected processes/modules. `context getWebviewHtml` showed outgoing calls to `nonce`, `renderWebviewStyleSection`, and `renderWebviewScriptSection`, with runtime flow participation in `ResolveWebviewView -> Nonce`, `ResolveWebviewView -> RenderWebviewStyleSection`, and `ResolveWebviewView -> RenderWebviewScriptSection`. `query "VS Code webview body render sections"` surfaced the same `ResolveWebviewView -> RenderWebviewScriptSection` flow and `getWebviewHtml`.

- [ ] **Step 1: Write the failing import and test**

Change the import to include `renderWebviewBodySection`:

```ts
import {
  getWebviewHtml,
  nonce,
  renderWebviewBodySection,
  renderWebviewScriptSection,
  renderWebviewStyleSection,
} from './webview-html.js';
```

Add this test in the existing `describe` block:

```ts
it('renders the body markup through a focused renderer', () => {
  const html = getWebviewHtml({ cspSource: 'vscode-webview://frontagent.test' } as never);
  const bodySection = html.match(/<body>\n([\s\S]*?)\n\n {2}<script nonce="/)?.[1];

  expect(bodySection).toBe(renderWebviewBodySection());
});
```

- [ ] **Step 2: Run focused test and verify RED**

Run:

```bash
pnpm --filter frontagent test -- src/webview-html.test.ts
```

Expected: FAIL because `renderWebviewBodySection` is not exported yet.

### Task 2: Extract the Body Markup Renderer

**Files:**
- Modify: `apps/vscode/src/webview-html.ts`
- Test: `apps/vscode/src/webview-html.test.ts`

- [ ] **Step 1: Add the renderer**

Move the exact current body markup from inside `<body>` into a new exported function after `renderWebviewScriptSection` and before `getWebviewHtml`:

```ts
export function renderWebviewBodySection(): string {
  return `  <div class="shell">
    <header class="top">
      ...
  </div>`;
}
```

The helper must preserve every existing ID, class, label, placeholder, text node, and indentation in the moved markup.

- [ ] **Step 2: Replace the inline body markup**

In `getWebviewHtml`, replace only the original body markup between `<body>` and `${renderWebviewScriptSection(scriptNonce)}` with:

```ts
${renderWebviewBodySection()}
```

- [ ] **Step 3: Run focused test and verify GREEN**

Run:

```bash
pnpm --filter frontagent test -- src/webview-html.test.ts
```

Expected: PASS with nonce, style, script, and body renderer tests passing.

### Task 3: Verify and Prepare PR

**Files:**
- Read: final diff only

- [ ] **Step 1: Run scoped and broader validation**

Run:

```bash
pnpm --filter frontagent test -- src/webview-html.test.ts
pnpm --filter frontagent typecheck
pnpm quality:precommit
```

Expected: commands pass. If `.gitnexus/*` index drift appears after quality gates, do not stage it unless the task explicitly asks for GitNexus seed updates.

- [ ] **Step 2: Run GitNexus detect changes**

Run:

```bash
npx gitnexus detect_changes --scope all --repo /Users/ceilf6/.config/superpowers/worktrees/FrontAgent-app/improve-vscode-webview-body-renderer
```

Expected: changed symbols are limited to `getWebviewHtml`, new `renderWebviewBodySection`, focused webview HTML test coverage, and this plan document.

- [ ] **Step 3: Open PR**

Push branch `improve/vscode-webview-body-renderer` and open a PR to `develop` with `Closes #223` and a GitNexus Impact Summary:

```md
## GitNexus Impact Summary

- Risk level: MEDIUM
- Critical skeleton changes: none; touched VS Code webview HTML helper extraction and focused test/plan only.
- GitNexus impact: `getWebviewHtml` upstream impact was LOW with 1 direct dependent (`apps/vscode/src/webview-html.test.ts`), 0 affected processes/modules; context/query found the existing `ResolveWebviewView` webview render flow. `detect_changes` reported MEDIUM risk with changed symbol `getWebviewHtml` and affected flows `ResolveWebviewView -> Nonce`, `ResolveWebviewView -> RenderWebviewStyleSection`, and `ResolveWebviewView -> RenderWebviewScriptSection`.
- Verification: include focused test, typecheck, quality gate, and `detect_changes` results.
```
