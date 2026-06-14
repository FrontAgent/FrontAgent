import { isIP } from 'node:net';

export class UrlSafetyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UrlSafetyError';
  }
}

/**
 * Returns true if the given dotted-quad IPv4 address falls within a
 * private, loopback, link-local, unspecified, or CGNAT range.
 */
export function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split('.');
  if (parts.length !== 4) return false;

  const octets: number[] = [];
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return false;
    const n = Number(part);
    if (n < 0 || n > 255) return false;
    octets.push(n);
  }
  const [a, b] = octets;

  // 0.0.0.0/8
  if (a === 0) return true;
  // 10.0.0.0/8
  if (a === 10) return true;
  // 100.64.0.0/10 (CGNAT)
  if (a === 100 && b >= 64 && b <= 127) return true;
  // 127.0.0.0/8 (loopback)
  if (a === 127) return true;
  // 169.254.0.0/16 (link-local, incl. 169.254.169.254 metadata)
  if (a === 169 && b === 254) return true;
  // 172.16.0.0/12
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.168.0.0/16
  if (a === 192 && b === 168) return true;

  return false;
}

/**
 * Parses an IPv6 address string into its 8 16-bit hextets.
 *
 * Strips a zone id (e.g. "%eth0") and surrounding brackets, expands the
 * "::" zero-run shorthand, and converts an embedded dotted-quad IPv4
 * tail (e.g. "::ffff:127.0.0.1") into two trailing hextets.
 *
 * Returns null if `addr` is not a valid IPv6 address per `net.isIP`, or
 * if it is otherwise malformed.
 */
export function expandIpv6(addr: string): number[] | null {
  let normalized = addr.trim().toLowerCase();

  // Strip surrounding brackets, e.g. "[::1]"
  if (normalized.startsWith('[') && normalized.endsWith(']')) {
    normalized = normalized.slice(1, -1);
  }

  // Strip zone id, e.g. "fe80::1%eth0"
  const zoneIndex = normalized.indexOf('%');
  if (zoneIndex !== -1) {
    normalized = normalized.slice(0, zoneIndex);
  }

  if (isIP(normalized) !== 6) return null;

  // If the address ends with a dotted-quad IPv4 tail (e.g.
  // "::ffff:127.0.0.1"), convert it into two hex groups first.
  const lastColon = normalized.lastIndexOf(':');
  const tail = normalized.slice(lastColon + 1);
  if (tail.includes('.')) {
    const octets = tail.split('.');
    if (octets.length !== 4) return null;
    const nums: number[] = [];
    for (const o of octets) {
      if (!/^\d{1,3}$/.test(o)) return null;
      const n = Number(o);
      if (n < 0 || n > 255) return null;
      nums.push(n);
    }
    const hi = ((nums[0] << 8) | nums[1]).toString(16);
    const lo = ((nums[2] << 8) | nums[3]).toString(16);
    normalized = `${normalized.slice(0, lastColon + 1)}${hi}:${lo}`;
  }

  const parts = normalized.split('::');
  if (parts.length > 2) return null;

  const head = parts[0].length > 0 ? parts[0].split(':') : [];
  const tailGroups = parts.length === 2 && parts[1].length > 0 ? parts[1].split(':') : [];

  let groups: string[];
  if (parts.length === 2) {
    const missing = 8 - (head.length + tailGroups.length);
    if (missing < 0) return null;
    groups = [...head, ...Array(missing).fill('0'), ...tailGroups];
  } else {
    groups = head;
  }

  if (groups.length !== 8) return null;

  const hextets: number[] = [];
  for (const g of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(g)) return null;
    hextets.push(parseInt(g, 16));
  }

  return hextets;
}

/**
 * Returns true if the given IPv6 address is loopback, unique-local,
 * link-local, unspecified, IPv4-mapped/IPv4-compatible with a private
 * embedded IPv4 address, or otherwise reserved for local use.
 */
export function isPrivateIpv6(ip: string): boolean {
  const h = expandIpv6(ip);
  if (!h) return false;

  const isZero = (n: number) => n === 0;

  // Unspecified ::
  if (h.every(isZero)) return true;

  // Loopback ::1
  if (h.slice(0, 7).every(isZero) && h[7] === 1) return true;

  // IPv4-mapped ::ffff:a.b.c.d
  if (h.slice(0, 5).every(isZero) && h[5] === 0xffff) {
    const v4 = `${h[6] >> 8}.${h[6] & 0xff}.${h[7] >> 8}.${h[7] & 0xff}`;
    return isPrivateIpv4(v4);
  }

  // IPv4-compatible (deprecated) ::a.b.c.d
  if (h.slice(0, 6).every(isZero)) {
    const v4 = `${h[6] >> 8}.${h[6] & 0xff}.${h[7] >> 8}.${h[7] & 0xff}`;
    return isPrivateIpv4(v4);
  }

  // fc00::/7 (Unique Local Address) -> top 7 bits are 1111110
  if ((h[0] & 0xfe00) === 0xfc00) return true;

  // fe80::/10 (link-local) -> top 10 bits are 1111111010
  if ((h[0] & 0xffc0) === 0xfe80) return true;

  return false;
}

/**
 * Returns true if the host should be blocked outright: localhost,
 * *.localhost, *.local, or a literal IP address that is private.
 */
export function isBlockedHostname(host: string): boolean {
  const h = host.toLowerCase().trim();

  if (h === 'localhost') return true;
  if (h.endsWith('.localhost')) return true;
  if (h.endsWith('.local')) return true;

  // Strip brackets from literal IPv6 hosts, e.g. "[::1]"
  const bare = h.startsWith('[') && h.endsWith(']') ? h.slice(1, -1) : h;

  // IPv4 literal
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(bare)) {
    return isPrivateIpv4(bare);
  }

  // IPv6 literal (contains a colon)
  if (bare.includes(':')) {
    return isPrivateIpv6(bare);
  }

  return false;
}

/**
 * Parses and validates a URL for safe outbound fetching.
 *
 * Throws UrlSafetyError unless:
 *  - protocol is http: or https:
 *  - there are no embedded credentials (username/password)
 *  - a host is present
 *  - the host is not in opts.denyHosts
 *  - if opts.allowHosts is given, the host must be in it
 *  - the host is not blocked per isBlockedHostname
 */
export function parseAndValidateUrl(
  rawUrl: string,
  opts?: { allowHosts?: string[]; denyHosts?: string[] },
): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new UrlSafetyError(`Invalid URL: ${rawUrl}`);
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new UrlSafetyError(`Unsupported protocol: ${url.protocol}`);
  }

  if (url.username || url.password) {
    throw new UrlSafetyError('URLs with embedded credentials are not allowed');
  }

  const host = url.hostname;
  if (!host) {
    throw new UrlSafetyError('URL has no host');
  }

  const lowerHost = host.toLowerCase();

  if (opts?.denyHosts?.some((h) => h.toLowerCase() === lowerHost)) {
    throw new UrlSafetyError(`Host is denied: ${host}`);
  }

  if (opts?.allowHosts && opts.allowHosts.length > 0) {
    if (!opts.allowHosts.some((h) => h.toLowerCase() === lowerHost)) {
      throw new UrlSafetyError(`Host is not in allow list: ${host}`);
    }
  }

  if (isBlockedHostname(host)) {
    throw new UrlSafetyError(`Host is blocked: ${host}`);
  }

  return url;
}

/**
 * Returns true if the given resolved connection address (IPv4 or IPv6,
 * without brackets) is private, loopback, link-local, or otherwise
 * unsafe to connect to.
 */
export function isConnectionAddressBlocked(address: string): boolean {
  return isPrivateIpv4(address) || isPrivateIpv6(address);
}
