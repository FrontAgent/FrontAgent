# VS Code Webview Script Renderer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve Issue #213 by extracting the VS Code webview script bootstrapping section from `getWebviewHtml` without changing generated HTML or CSP nonce behavior.

**Architecture:** Keep `getWebviewHtml(webview)` as the public renderer that owns CSP construction and top-level document assembly. Add `renderWebviewScriptSection(scriptNonce)` beside the existing style renderer so the `<script>` nonce remains passed explicitly and all bootstrapping JavaScript stays in one cohesive renderer.

**Tech Stack:** TypeScript, VS Code webview HTML, Vitest, GitNexus CLI.

---

### Task 1: Add the Script Renderer Contract Test

**Files:**
- Modify: `apps/vscode/src/webview-html.test.ts`
- Read: `apps/vscode/src/webview-html.ts`

**GitNexus impact before code edits:** `npx gitnexus impact getWebviewHtml --direction upstream --file apps/vscode/src/webview-html.ts --kind Function --include-tests --repo FrontAgent-issue213` reported LOW risk, 1 direct dependent (`apps/vscode/src/webview-html.test.ts`), and 0 affected processes/modules in impact output. `context getWebviewHtml` shows runtime flow participation in `ResolveWebviewView -> Nonce` and `ResolveWebviewView -> RenderWebviewStyleSection`.

- [ ] **Step 1: Write the failing import and test**

Change the import to include `renderWebviewScriptSection`:

```ts
import {
  getWebviewHtml,
  nonce,
  renderWebviewScriptSection,
  renderWebviewStyleSection,
} from './webview-html.js';
```

Add this test in the existing `describe` block:

```ts
it('renders the script bootstrapping section through a focused renderer', () => {
  const html = getWebviewHtml({ cspSource: 'vscode-webview://frontagent.test' } as never);
  const scriptNonce = html.match(/<script nonce="([^"]+)"/)?.[1];
  const scriptSection = html.match(/ {2}<script nonce="[^"]+">[\s\S]*? {2}<\/script>/)?.[0];

  expect(scriptNonce).toBeDefined();
  expect(scriptSection).toBe(renderWebviewScriptSection(scriptNonce ?? ''));
});
```

- [ ] **Step 2: Run focused test and verify RED**

Run:

```bash
pnpm --dir apps/vscode test src/webview-html.test.ts
```

Expected: FAIL because `renderWebviewScriptSection` is not exported yet.

### Task 2: Extract the Script Bootstrapping Renderer

**Files:**
- Modify: `apps/vscode/src/webview-html.ts`
- Test: `apps/vscode/src/webview-html.test.ts`

- [ ] **Step 1: Add the renderer**

Move the exact current inline script block out of `getWebviewHtml` into a new exported function after `renderWebviewStyleSection` and before `getWebviewHtml`. The moved block starts with this line:

```ts
export function renderWebviewScriptSection(scriptNonce: string): string {
  return `  <script nonce="${scriptNonce}">
    const vscode = acquireVsCodeApi();
```

The moved block ends with these lines:

```ts
    vscode.postMessage({ type: 'ready' });
  </script>`;
}
```

- [ ] **Step 2: Replace the inline script section**

In `getWebviewHtml`, replace only the original `<script nonce="${scriptNonce}">...</script>` section with:

```ts
${renderWebviewScriptSection(scriptNonce)}
```

- [ ] **Step 3: Run focused test and verify GREEN**

Run:

```bash
pnpm --dir apps/vscode test src/webview-html.test.ts
```

Expected: PASS with the new script renderer test and existing nonce/style tests passing.

### Task 3: Verify and Prepare PR

**Files:**
- Read: final diff only

- [ ] **Step 1: Run scoped and broader validation**

Run:

```bash
pnpm --dir apps/vscode test src/webview-html.test.ts
pnpm --dir apps/vscode test
pnpm typecheck
pnpm quality:precommit
```

Expected: tests and typecheck pass. If `quality:precommit` fails because unrelated dirty authority/GitNexus files are present, do not stage those files; report the exact failure and keep the PR diff scoped.

- [ ] **Step 2: Run GitNexus detect changes**

Run:

```bash
npx gitnexus detect-changes --repo FrontAgent-issue213 --scope all
```

Expected: changed symbols are limited to `getWebviewHtml`, `renderWebviewScriptSection`, test coverage, and this plan document.

- [ ] **Step 3: Open PR**

Push branch `improve/vscode-webview-body-script-renderer` and open a PR to `develop` with:

```md
Closes #213

GitNexus impact summary:
- `getWebviewHtml` upstream impact: LOW; 1 direct dependent (`apps/vscode/src/webview-html.test.ts`); 0 affected processes/modules in impact output.
- `detect_changes`: include the final changed symbol/process summary from the command output.
```
