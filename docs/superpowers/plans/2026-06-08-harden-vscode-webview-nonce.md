# Harden VS Code Webview Nonce Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace VS Code webview CSP nonce generation with cryptographic randomness and add focused regression tests.

**Architecture:** Keep the existing `getWebviewHtml()` API and CSP structure unchanged. Change only `nonce()` internals to use Node crypto entropy, while tests assert nonce shape, uniqueness, and CSP-to-tag injection consistency.

**Tech Stack:** TypeScript, Vitest, Node `node:crypto`, VS Code webview HTML helpers.

---

### Task 1: Add Focused Webview Nonce Tests

**Files:**
- Create: `apps/vscode/src/webview-html.test.ts`
- Read: `apps/vscode/src/webview-html.ts`

- [ ] **Step 1: Write failing nonce shape and uniqueness tests**

```ts
import { describe, expect, it } from 'vitest';
import { getWebviewHtml, nonce } from './webview-html.js';

describe('VS Code webview HTML nonce handling', () => {
  it('generates base64url nonces from cryptographic bytes', () => {
    const values = Array.from({ length: 64 }, () => nonce());

    for (const value of values) {
      expect(value).toMatch(/^[A-Za-z0-9_-]{43}$/);
    }
    expect(new Set(values).size).toBe(values.length);
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm --dir apps/vscode test src/webview-html.test.ts`
Expected: FAIL because the existing `Math.random()` nonce returns 32 alphanumeric characters, not 43 base64url characters.

- [ ] **Step 3: Add CSP injection test**

```ts
it('injects matching CSP and element nonces into the webview HTML', () => {
  const html = getWebviewHtml({ cspSource: 'vscode-webview://frontagent.test' } as never);
  const csp = html.match(/Content-Security-Policy" content="([^"]+)"/)?.[1];
  const styleNonce = html.match(/<style nonce="([^"]+)"/)?.[1];
  const scriptNonce = html.match(/<script nonce="([^"]+)"/)?.[1];

  expect(csp).toBeDefined();
  expect(styleNonce).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(scriptNonce).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(styleNonce).not.toBe(scriptNonce);
  expect(csp).toContain("style-src vscode-webview://frontagent.test 'nonce-" + styleNonce + "'");
  expect(csp).toContain("script-src 'nonce-" + scriptNonce + "'");
});
```

Run: `pnpm --dir apps/vscode test src/webview-html.test.ts`
Expected: FAIL for nonce shape until Task 2 is implemented.

### Task 2: Implement Cryptographic Nonce Generation

**Files:**
- Modify: `apps/vscode/src/webview-html.ts`
- Test: `apps/vscode/src/webview-html.test.ts`

- [ ] **Step 1: Replace `Math.random()` with Node crypto**

```ts
import { randomBytes } from 'node:crypto';
import type * as vscode from 'vscode';

export function nonce(): string {
  return randomBytes(32)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
```

- [ ] **Step 2: Run focused test and verify GREEN**

Run: `pnpm --dir apps/vscode test src/webview-html.test.ts`
Expected: PASS.

- [ ] **Step 3: Run required verification gates**

Run: `pnpm --dir apps/vscode test`
Expected: PASS.

Run: `pnpm typecheck`
Expected: PASS.

Run: `pnpm lint` or touched-file lint if available.
Expected: PASS or document unavailable script.

Run: `pnpm quality:precommit`
Expected: PASS unless GitNexus environment issue blocks; document exact failure if blocked.

Run: `npx gitnexus detect-changes --repo /Users/ceilf6/Desktop/myrepos/Wiki/AI/3-Application/FrontAgent-app`
Expected: LOW/MEDIUM scoped impact for `apps/vscode/src/webview-html.ts` and its test.
