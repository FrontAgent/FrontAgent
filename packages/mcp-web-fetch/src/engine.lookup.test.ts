import type { LookupAddress } from 'node:dns';
import { describe, expect, it } from 'vitest';
import { safeLookup } from './engine.js';

/**
 * These tests exercise `safeLookup` directly — the function undici's
 * dispatcher actually calls at connection time. All cases use local-only
 * resolution (loopback hostnames and IP literals), so no external network
 * access is required:
 *  - Literal IPs are returned by `dns.lookup` without a network query.
 *  - 'localhost' is resolved via the hosts file (local).
 */
function runLookup(hostname: string): Promise<{
  err: NodeJS.ErrnoException | null;
  address: string | LookupAddress[];
  family?: number;
}> {
  return new Promise((resolve) => {
    safeLookup(hostname, {}, (err, address, family) => {
      resolve({ err, address, family });
    });
  });
}

describe('safeLookup', () => {
  it('blocks localhost (resolves to a loopback address)', async () => {
    const { err } = await runLookup('localhost');
    expect(err).not.toBeNull();
    expect(err?.message).toMatch(/private|blocked/i);
  });

  it('blocks the literal IPv4 loopback address 127.0.0.1', async () => {
    const { err } = await runLookup('127.0.0.1');
    expect(err).not.toBeNull();
    expect(err?.message).toMatch(/private|blocked/i);
  });

  it('blocks the literal IPv6 loopback address ::1', async () => {
    const { err } = await runLookup('::1');
    expect(err).not.toBeNull();
    expect(err?.message).toMatch(/private|blocked/i);
  });

  it('allows a literal public IPv4 address', async () => {
    const { err, address } = await runLookup('8.8.8.8');
    expect(err).toBeNull();
    expect(address).toBe('8.8.8.8');
  });
});
