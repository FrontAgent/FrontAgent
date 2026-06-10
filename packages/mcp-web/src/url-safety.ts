/**
 * URL safety checks for the web MCP tools.
 *
 * Guards against SSRF and local-file access through the browser:
 *  - only `http:` / `https:` schemes are allowed (blocks `file:`,
 *    `javascript:`, `data:`, etc.)
 *  - link-local addresses (incl. the cloud metadata IP 169.254.169.254)
 *    are always blocked
 *  - loopback / private-network targets are allowed by default because
 *    FrontAgent is a frontend dev agent that legitimately drives local dev
 *    servers; set FRONTAGENT_BLOCK_PRIVATE_URLS=1 to block them too
 */

export interface UrlSafetyOptions {
  /** Block loopback and private network ranges (default false). */
  blockPrivate?: boolean;
}

export interface UrlSafetyResult {
  ok: boolean;
  error?: string;
}

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

const LOCAL_HOSTNAMES = new Set(['localhost', 'ip6-localhost', 'ip6-loopback']);

function stripBrackets(hostname: string): string {
  return hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;
}

function parseIpv4(host: string): number[] | undefined {
  const parts = host.split('.');
  if (parts.length !== 4) return undefined;
  const octets: number[] = [];
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return undefined;
    const value = Number(part);
    if (value > 255) return undefined;
    octets.push(value);
  }
  return octets;
}

function isLinkLocalIpv4(octets: number[]): boolean {
  // 169.254.0.0/16 — includes the cloud metadata IP 169.254.169.254
  return octets[0] === 169 && octets[1] === 254;
}

function isPrivateIpv4(octets: number[]): boolean {
  const [a, b] = octets;
  if (a === 127) return true; // loopback
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 0) return true; // 0.0.0.0/8
  return false;
}

function isLinkLocalIpv6(host: string): boolean {
  const h = host.toLowerCase();
  // fe80::/10 link-local
  if (h.startsWith('fe8') || h.startsWith('fe9') || h.startsWith('fea') || h.startsWith('feb')) {
    return true;
  }
  return false;
}

function isLoopbackIpv6(host: string): boolean {
  const h = host.toLowerCase();
  return h === '::1' || h === '0:0:0:0:0:0:0:1';
}

export function checkUrlSafety(rawUrl: string, options: UrlSafetyOptions = {}): UrlSafetyResult {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, error: `Invalid URL: ${rawUrl}` };
  }

  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    return {
      ok: false,
      error: `Blocked URL scheme "${url.protocol}": only http and https are allowed`,
    };
  }

  const host = stripBrackets(url.hostname).toLowerCase();
  const ipv4 = parseIpv4(host);

  // Always block link-local (cloud metadata endpoint lives here).
  if (ipv4 && isLinkLocalIpv4(ipv4)) {
    return { ok: false, error: `Blocked link-local address: ${url.hostname}` };
  }
  if (!ipv4 && isLinkLocalIpv6(host)) {
    return { ok: false, error: `Blocked link-local address: ${url.hostname}` };
  }
  if (host === 'metadata.google.internal') {
    return { ok: false, error: 'Blocked cloud metadata host' };
  }

  if (options.blockPrivate) {
    if (LOCAL_HOSTNAMES.has(host)) {
      return { ok: false, error: `Blocked loopback host: ${url.hostname}` };
    }
    if (ipv4 && isPrivateIpv4(ipv4)) {
      return { ok: false, error: `Blocked private/loopback address: ${url.hostname}` };
    }
    if (!ipv4 && isLoopbackIpv6(host)) {
      return { ok: false, error: `Blocked loopback address: ${url.hostname}` };
    }
  }

  return { ok: true };
}

/** Read the default safety policy from the environment. */
export function defaultUrlSafetyOptions(): UrlSafetyOptions {
  return { blockPrivate: process.env.FRONTAGENT_BLOCK_PRIVATE_URLS === '1' };
}
