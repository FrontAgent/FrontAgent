import { describe, expect, it } from 'vitest';
import { handleWebFetchTool } from './tools.js';

describe('mcp-web-fetch SSRF guards (no network)', () => {
  it('rejects loopback IPv4 addresses', async () => {
    const result = await handleWebFetchTool('web_fetch', { url: 'http://127.0.0.1/' });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/private|blocked|loopback|safety|denied/i);
  });

  it('rejects localhost', async () => {
    const result = await handleWebFetchTool('web_fetch', { url: 'http://localhost/' });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/private|blocked|loopback|safety|denied/i);
  });

  it('rejects cloud metadata addresses', async () => {
    const result = await handleWebFetchTool('web_fetch', {
      url: 'http://169.254.169.254/latest/meta-data/',
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/private|blocked|loopback|safety|denied/i);
  });

  it('rejects file: URLs', async () => {
    const result = await handleWebFetchTool('web_fetch', { url: 'file:///etc/passwd' });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/private|blocked|loopback|safety|denied|protocol/i);
  });

  it('rejects ftp: URLs', async () => {
    const result = await handleWebFetchTool('web_fetch', { url: 'ftp://example.com' });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/private|blocked|loopback|safety|denied|protocol/i);
  });

  it('rejects URLs with embedded credentials', async () => {
    const result = await handleWebFetchTool('web_fetch', {
      url: 'http://user:pass@example.com/',
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/private|blocked|loopback|safety|denied|credentials/i);
  });

  it('rejects unknown tool names', async () => {
    const result = await handleWebFetchTool('not_a_real_tool', { url: 'https://example.com' });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/unknown/i);
  });
});
