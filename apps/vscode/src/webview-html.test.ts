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

  it('injects matching CSP and element nonces into the webview HTML', () => {
    const html = getWebviewHtml({ cspSource: 'vscode-webview://frontagent.test' } as never);
    const csp = html.match(/Content-Security-Policy" content="([^"]+)"/)?.[1];
    const styleNonce = html.match(/<style nonce="([^"]+)"/)?.[1];
    const scriptNonce = html.match(/<script nonce="([^"]+)"/)?.[1];

    expect(csp).toBeDefined();
    expect(styleNonce).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(scriptNonce).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(styleNonce).not.toBe(scriptNonce);
    expect(csp).toContain(`style-src vscode-webview://frontagent.test 'nonce-${styleNonce}'`);
    expect(csp).toContain(`script-src 'nonce-${scriptNonce}'`);
  });
});
