# VS Code Webview Section Renderers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve Issue #202 by extracting one cohesive VS Code webview HTML section renderer while preserving current rendered output and CSP nonce behavior.

**Architecture:** Keep `getWebviewHtml(webview)` as the public HTML entry point. Extract only the CSS `<style>` section into `renderWebviewStyleSection(styleNonce)` in `apps/vscode/src/webview-html.ts`, so nonce wiring remains explicit and future CSS changes can be reviewed independently.

**Tech Stack:** TypeScript, VS Code webview HTML, Vitest.

---

### Task 1: Add a Focused Renderer Contract Test

**Files:**
- Modify: `apps/vscode/src/webview-html.test.ts`
- Read: `apps/vscode/src/webview-html.ts`

- [ ] **Step 1: Write the failing test**

Add an import for `renderWebviewStyleSection`, then add this test in the existing `describe` block:

```ts
it('renders the style section through a focused renderer', () => {
  const html = getWebviewHtml({ cspSource: 'vscode-webview://frontagent.test' } as never);
  const styleNonce = html.match(/<style nonce="([^"]+)"/)?.[1];
  const styleSection = html.match(/  <style nonce="[^"]+">[\s\S]*?  <\/style>/)?.[0];

  expect(styleNonce).toBeDefined();
  expect(styleSection).toBe(renderWebviewStyleSection(styleNonce ?? ''));
});
```

- [ ] **Step 2: Run focused test and verify RED**

Run: `pnpm --dir apps/vscode test src/webview-html.test.ts`
Expected: FAIL because `renderWebviewStyleSection` is not exported yet.

### Task 2: Extract the CSS Section Renderer

**Files:**
- Modify: `apps/vscode/src/webview-html.ts`
- Test: `apps/vscode/src/webview-html.test.ts`

- [ ] **Step 1: Add the renderer**

Move the existing `<style nonce="${styleNonce}">...</style>` string into:

```ts
export function renderWebviewStyleSection(styleNonce: string): string {
  return `  <style nonce="${styleNonce}">
    ...
  </style>`;
}
```

- [ ] **Step 2: Replace the inline section**

In `getWebviewHtml`, replace only the original inline style section with:

```ts
${renderWebviewStyleSection(styleNonce)}
```

- [ ] **Step 3: Run focused test and verify GREEN**

Run: `pnpm --dir apps/vscode test src/webview-html.test.ts`
Expected: PASS.

### Task 3: Verify and Prepare PR

**Files:**
- Read: final diff only

- [ ] **Step 1: Run scoped and required gates**

Run:

```bash
pnpm --dir apps/vscode test
pnpm typecheck
pnpm quality:precommit
```

- [ ] **Step 2: Run GitNexus detect changes**

Run:

```bash
npx gitnexus detect-changes --repo "/Users/ceilf6/Desktop/myrepos/Wiki/AI/3-Application/FrontAgent-app" --scope all
```

Expected: scoped changes in `apps/vscode/src/webview-html.ts`, `apps/vscode/src/webview-html.test.ts`, and this plan.

- [ ] **Step 3: Open PR**

Push `improve/vscode-webview-section-renderers` and open a PR to `develop` with `Closes #202` and the GitNexus impact summary.
