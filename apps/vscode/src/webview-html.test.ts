import { describe, expect, it } from 'vitest';
import {
  getWebviewHtml,
  nonce,
  renderWebviewBodySection,
  renderWebviewScriptSection,
  renderWebviewStyleSection,
} from './webview-html.js';

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

  it('renders the style section through a focused renderer', () => {
    const html = getWebviewHtml({ cspSource: 'vscode-webview://frontagent.test' } as never);
    const styleNonce = html.match(/<style nonce="([^"]+)"/)?.[1];
    const styleSection = html.match(/ {2}<style nonce="[^"]+">[\s\S]*? {2}<\/style>/)?.[0];

    expect(styleNonce).toBeDefined();
    expect(styleSection).toBe(renderWebviewStyleSection(styleNonce ?? ''));
  });

  it('renders the script bootstrapping section through a focused renderer', () => {
    const html = getWebviewHtml({ cspSource: 'vscode-webview://frontagent.test' } as never);
    const scriptNonce = html.match(/<script nonce="([^"]+)"/)?.[1];
    const scriptSection = html.match(/ {2}<script nonce="[^"]+">[\s\S]*? {2}<\/script>/)?.[0];

    expect(scriptNonce).toBeDefined();
    expect(scriptSection).toBe(renderWebviewScriptSection(scriptNonce ?? ''));
  });

  it('renders the body markup through a focused renderer', () => {
    const html = getWebviewHtml({ cspSource: 'vscode-webview://frontagent.test' } as never);
    const bodySection = html.match(/<body>\n([\s\S]*?)\n\n {2}<script nonce="/)?.[1];

    expect(bodySection).toBe(renderWebviewBodySection());
  });
});
