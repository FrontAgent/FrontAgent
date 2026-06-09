import { describe, expect, it } from 'vitest';
import {
  getWebviewHtml,
  nonce,
  renderWebviewBaseStyles,
  renderWebviewBodySection,
  renderWebviewComposerStyles,
  renderWebviewConfigScript,
  renderWebviewContextScript,
  renderWebviewErrorScript,
  renderWebviewEventScript,
  renderWebviewHeaderStyles,
  renderWebviewMessageScript,
  renderWebviewMessageStyles,
  renderWebviewMotionStyles,
  renderWebviewScriptSection,
  renderWebviewStateScript,
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

  it('assembles the style section from focused CSS helpers', () => {
    const styleNonce = 'style-test-nonce';
    const section = renderWebviewStyleSection(styleNonce);
    const helpers = [
      renderWebviewBaseStyles(),
      renderWebviewHeaderStyles(),
      renderWebviewMessageStyles(),
      renderWebviewComposerStyles(),
      renderWebviewMotionStyles(),
    ];

    expect(section).toBe(`  <style nonce="${styleNonce}">
${helpers.join('\n')}
  </style>`);
    expect(section).toContain(':root {');
    expect(section).toContain('--accent: var(--vscode-button-background);');
    expect(section).toContain('.config-banner.ready {');
    expect(section).toContain('.messages {');
    expect(section).toContain('.live-dot {');
    expect(section).toContain('.composer-card:focus-within {');
    expect(section).toContain('#prompt {');
    expect(section).toContain('@media (prefers-reduced-motion: no-preference) {');
  });

  it('renders the script bootstrapping section through a focused renderer', () => {
    const html = getWebviewHtml({ cspSource: 'vscode-webview://frontagent.test' } as never);
    const scriptNonce = html.match(/<script nonce="([^"]+)"/)?.[1];
    const scriptSection = html.match(/ {2}<script nonce="[^"]+">[\s\S]*? {2}<\/script>/)?.[0];

    expect(scriptNonce).toBeDefined();
    expect(scriptSection).toBe(renderWebviewScriptSection(scriptNonce ?? ''));
  });

  it('assembles the script section from focused template helpers', () => {
    const scriptNonce = 'script-test-nonce';
    const section = renderWebviewScriptSection(scriptNonce);
    const helpers = [
      renderWebviewStateScript(),
      renderWebviewConfigScript(),
      renderWebviewContextScript(),
      renderWebviewMessageScript(),
      renderWebviewEventScript(),
      renderWebviewErrorScript(),
    ];

    expect(section).toBe(`  <script nonce="${scriptNonce}">
${helpers.join('\n')}

    vscode.postMessage({ type: 'ready' });
  </script>`);
    expect(section).toContain('acquireVsCodeApi()');
    expect(section).toContain("vscode.postMessage({ type: 'ready' });");
    expect(section).toContain("type: 'send'");
    expect(section).toContain("type: 'saveConfig'");
    expect(section).toContain("type: 'approve'");
    expect(section).toContain("type: 'reject'");
    expect(section).toContain("type: 'webviewError'");
    expect(section).toContain("$('composer').addEventListener('submit'");
    expect(section).toContain("$('contextFiles').addEventListener('click'");
    expect(section).toContain("window.addEventListener('message'");
    expect(section).toContain("window.addEventListener('error'");
    expect(section).toContain("window.addEventListener('unhandledrejection'");
    expect(section).toContain('data-remove-file');
    expect(section).toContain(`replace(/[&<>"']/g`);
  });

  it('renders the body markup through a focused renderer', () => {
    const html = getWebviewHtml({ cspSource: 'vscode-webview://frontagent.test' } as never);
    const bodySection = html.match(/<body>\n([\s\S]*?)\n\n {2}<script nonce="/)?.[1];

    expect(bodySection).toBe(renderWebviewBodySection());
  });
});
