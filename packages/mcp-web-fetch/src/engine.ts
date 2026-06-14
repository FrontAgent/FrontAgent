import type { LookupAddress, LookupOptions } from 'node:dns';
import dns from 'node:dns';
import { Agent } from 'undici';
import { htmlToText } from './html-to-text.js';
import { isConnectionAddressBlocked, parseAndValidateUrl, UrlSafetyError } from './url-safety.js';

export interface FetchResult {
  url: string;
  finalUrl: string;
  status: number;
  contentType: string | null;
  title: string | null;
  text: string;
  bytes: number;
  truncated: boolean;
}

export interface FetchOptions {
  timeoutMs?: number;
  maxBytes?: number;
  userAgent?: string;
  format?: 'text' | 'html';
  allowHosts?: string[];
  denyHosts?: string[];
  maxRedirects?: number;
  /**
   * Test-only injection seam: overrides the `fetch` implementation used to
   * issue requests. Defaults to the global `fetch`. Not intended for
   * production use — when supplied, the `dispatcher: safeDispatcher` option
   * is still passed but a mock implementation may ignore it.
   */
  fetchImpl?: typeof fetch;
}

export const DEFAULT_TIMEOUT_MS = 15000;
export const DEFAULT_MAX_BYTES = 2_000_000;
export const HARD_MAX_TIMEOUT_MS = 60_000;
export const HARD_MAX_BYTES = 5_000_000;
const DEFAULT_MAX_REDIRECTS = 5;
const HARD_MAX_REDIRECTS = 10;
const DEFAULT_USER_AGENT = 'frontagent-mcp-web-fetch/2.1.1 (+https://github.com/frontagent)';

/**
 * Clamps a caller-supplied numeric limit to a safe, bounded integer.
 *
 * Returns `def` for any non-finite, non-numeric, zero, or negative input.
 * Fractional values are floored. Values above `hardMax` are capped to
 * `hardMax`, regardless of what the caller requested.
 */
export function clampLimit(value: unknown, def: number, hardMax: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return def;
  return Math.min(Math.floor(value), hardMax);
}

/**
 * DNS lookup used by the safe undici dispatcher. Resolves the hostname and
 * rejects (via UrlSafetyError) if the resolved address is private/loopback/
 * link-local — enforced at CONNECTION time so the validated address is the
 * one actually connected to (DNS-rebinding-safe). Exported for direct testing.
 */
export function safeLookup(
  hostname: string,
  options: LookupOptions,
  callback: (
    err: NodeJS.ErrnoException | null,
    address: string | LookupAddress[],
    family?: number,
  ) => void,
): void {
  dns.lookup(hostname, { ...options, all: false }, (err, address, family) => {
    if (err) {
      callback(err, address, family);
      return;
    }
    const resolved = address as string;
    if (isConnectionAddressBlocked(resolved)) {
      callback(
        new UrlSafetyError(`Blocked private address ${resolved} for host ${hostname}`),
        resolved,
        family,
      );
      return;
    }
    callback(null, resolved, family);
  });
}

/**
 * Undici dispatcher whose DNS lookup validates the resolved address at
 * connection time, closing the TOCTOU gap between SSRF pre-validation
 * (parseAndValidateUrl) and the actual network connection.
 */
const safeDispatcher = new Agent({
  connect: {
    lookup: safeLookup,
  },
});

/**
 * Fetch a URL and return cleaned, readable text along with metadata.
 *
 * Performs SSRF-safety validation (URL shape) on every hop of the
 * redirect chain before issuing any network request, and routes all
 * requests through a dispatcher that validates the resolved connection
 * address at connect time (closing the DNS-rebinding TOCTOU gap).
 */
export async function fetchUrl(rawUrl: string, opts: FetchOptions = {}): Promise<FetchResult> {
  const timeoutMs = clampLimit(opts.timeoutMs, DEFAULT_TIMEOUT_MS, HARD_MAX_TIMEOUT_MS);
  const maxBytes = clampLimit(opts.maxBytes, DEFAULT_MAX_BYTES, HARD_MAX_BYTES);
  const maxRedirects = clampLimit(opts.maxRedirects, DEFAULT_MAX_REDIRECTS, HARD_MAX_REDIRECTS);
  const format = opts.format ?? 'text';
  const userAgent = opts.userAgent ?? DEFAULT_USER_AGENT;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const doFetch = opts.fetchImpl ?? fetch;

  try {
    let currentUrl = parseAndValidateUrl(rawUrl, {
      allowHosts: opts.allowHosts,
      denyHosts: opts.denyHosts,
    });

    let response: Response | undefined;
    let redirectCount = 0;

    for (;;) {
      let res: Response;
      try {
        res = await doFetch(currentUrl, {
          redirect: 'manual',
          signal: controller.signal,
          headers: { 'user-agent': userAgent },
          dispatcher: safeDispatcher,
        } as RequestInit);
      } catch (err) {
        if (controller.signal.aborted) {
          throw new Error(`Request timed out after ${timeoutMs}ms: ${currentUrl}`);
        }
        throw err;
      }

      const isRedirect = res.status >= 300 && res.status < 400 && res.headers.has('location');
      if (!isRedirect) {
        response = res;
        break;
      }

      redirectCount++;
      if (redirectCount > maxRedirects) {
        throw new Error(`Exceeded maximum redirects (${maxRedirects}) while fetching ${rawUrl}`);
      }

      const location = res.headers.get('location')!;
      const nextUrl = new URL(location, currentUrl);
      currentUrl = parseAndValidateUrl(nextUrl.toString(), {
        allowHosts: opts.allowHosts,
        denyHosts: opts.denyHosts,
      });
    }

    const finalUrl = currentUrl.toString();
    const contentType = response.headers.get('content-type');

    const { bytes, truncated, text: rawText } = await readBody(response, maxBytes);

    let title: string | null = null;
    let text: string;

    const looksHtml = (contentType ?? '').toLowerCase().includes('html');
    const treatAsHtml = looksHtml || (format === 'text' && looksLikeHtml(rawText));

    if (treatAsHtml) {
      const converted = htmlToText(rawText);
      title = converted.title;
      text = format === 'html' ? rawText : converted.text;
    } else {
      text = rawText;
    }

    return {
      url: rawUrl,
      finalUrl,
      status: response.status,
      contentType,
      title,
      text,
      bytes,
      truncated,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function readBody(
  response: Response,
  maxBytes: number,
): Promise<{ bytes: number; truncated: boolean; text: string }> {
  if (!response.body) {
    const buf = await response.arrayBuffer();
    const truncated = buf.byteLength > maxBytes;
    const slice = truncated ? buf.slice(0, maxBytes) : buf;
    return { bytes: slice.byteLength, truncated, text: new TextDecoder().decode(slice) };
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let truncated = false;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    if (total + value.length > maxBytes) {
      const remaining = maxBytes - total;
      if (remaining > 0) {
        chunks.push(value.subarray(0, remaining));
        total += remaining;
      }
      truncated = true;
      await reader.cancel().catch(() => {});
      break;
    }

    chunks.push(value);
    total += value.length;
  }

  const combined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }

  return { bytes: total, truncated, text: new TextDecoder().decode(combined) };
}

function looksLikeHtml(text: string): boolean {
  const sample = text.slice(0, 1024).trimStart().toLowerCase();
  return (
    sample.startsWith('<!doctype html') || sample.startsWith('<html') || sample.includes('<body')
  );
}
