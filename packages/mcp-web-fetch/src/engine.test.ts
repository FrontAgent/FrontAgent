import { describe, expect, it, vi } from 'vitest';
import { fetchUrl } from './engine.js';

describe('fetchUrl', () => {
  it('rejects a redirect to a private address without following it', async () => {
    const mock = vi.fn(
      async () =>
        new Response(null, {
          status: 302,
          headers: { location: 'http://127.0.0.1/secret' },
        }),
    );

    await expect(
      fetchUrl('https://example.com/', { fetchImpl: mock as unknown as typeof fetch }),
    ).rejects.toThrow();

    expect(mock).toHaveBeenCalledTimes(1);
  });

  it('truncates the body when it exceeds maxBytes', async () => {
    const largeBody = 'x'.repeat(1000);
    const mock = vi.fn(
      async () =>
        new Response(largeBody, {
          status: 200,
          headers: { 'content-type': 'text/plain' },
        }),
    );

    const result = await fetchUrl('https://example.com/', {
      fetchImpl: mock as unknown as typeof fetch,
      maxBytes: 100,
    });

    expect(result.truncated).toBe(true);
    expect(result.bytes).toBeLessThanOrEqual(100);
  });

  it('throws once the redirect count exceeds maxRedirects', async () => {
    const mock = vi.fn(
      async () =>
        new Response(null, {
          status: 302,
          headers: { location: 'http://example.org/next' },
        }),
    );

    await expect(
      fetchUrl('https://example.com/', {
        fetchImpl: mock as unknown as typeof fetch,
        maxRedirects: 2,
      }),
    ).rejects.toThrow();
  });

  it('returns text and title for a successful HTML response', async () => {
    const mock = vi.fn(
      async () =>
        new Response('<title>Hi</title><p>Hello</p>', {
          status: 200,
          headers: { 'content-type': 'text/html' },
        }),
    );

    const result = await fetchUrl('https://example.com/', {
      fetchImpl: mock as unknown as typeof fetch,
    });

    expect(result.status).toBe(200);
    expect(result.title).toBe('Hi');
    expect(result.text).toContain('Hello');
  });
});
