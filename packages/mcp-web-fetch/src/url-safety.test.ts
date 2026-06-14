import { describe, expect, it } from 'vitest';
import {
  isBlockedHostname,
  isPrivateIpv4,
  isPrivateIpv6,
  parseAndValidateUrl,
  UrlSafetyError,
} from './url-safety.js';

describe('isPrivateIpv4', () => {
  it('returns true for private/loopback/link-local addresses', () => {
    expect(isPrivateIpv4('127.0.0.1')).toBe(true);
    expect(isPrivateIpv4('10.0.0.1')).toBe(true);
    expect(isPrivateIpv4('192.168.1.1')).toBe(true);
    expect(isPrivateIpv4('172.16.0.1')).toBe(true);
    expect(isPrivateIpv4('169.254.169.254')).toBe(true);
  });

  it('returns false for public addresses', () => {
    expect(isPrivateIpv4('8.8.8.8')).toBe(false);
    expect(isPrivateIpv4('1.1.1.1')).toBe(false);
  });
});

describe('isPrivateIpv6', () => {
  it('returns true for loopback/ULA/link-local addresses', () => {
    expect(isPrivateIpv6('::1')).toBe(true);
    expect(isPrivateIpv6('fe80::1')).toBe(true);
    expect(isPrivateIpv6('fc00::1')).toBe(true);
    expect(isPrivateIpv6('::')).toBe(true);
  });

  it('returns true for IPv4-mapped/compatible addresses with private embedded IPv4, in dotted and hex hextet forms', () => {
    expect(isPrivateIpv6('::ffff:127.0.0.1')).toBe(true);
    expect(isPrivateIpv6('::ffff:7f00:1')).toBe(true);
    expect(isPrivateIpv6('::ffff:0a00:1')).toBe(true);
    expect(isPrivateIpv6('::ffff:192.168.1.1')).toBe(true);
    expect(isPrivateIpv6('0:0:0:0:0:ffff:127.0.0.1')).toBe(true);
    expect(isPrivateIpv6('0:0:0:0:0:ffff:7f00:1')).toBe(true);
  });

  it('returns false for public addresses', () => {
    expect(isPrivateIpv6('2606:4700::1')).toBe(false);
    expect(isPrivateIpv6('2606:4700:4700::1111')).toBe(false);
    expect(isPrivateIpv6('2001:4860:4860::8888')).toBe(false);
  });
});

describe('isBlockedHostname', () => {
  it('returns true for localhost and private IP literals', () => {
    expect(isBlockedHostname('localhost')).toBe(true);
    expect(isBlockedHostname('127.0.0.1')).toBe(true);
    expect(isBlockedHostname('foo.localhost')).toBe(true);
    expect(isBlockedHostname('printer.local')).toBe(true);
  });

  it('returns false for normal public hostnames', () => {
    expect(isBlockedHostname('example.com')).toBe(false);
  });
});

describe('parseAndValidateUrl', () => {
  it('throws for unsupported protocols', () => {
    expect(() => parseAndValidateUrl('ftp://x')).toThrow(UrlSafetyError);
    expect(() => parseAndValidateUrl('file:///etc/passwd')).toThrow(UrlSafetyError);
  });

  it('throws for embedded credentials', () => {
    expect(() => parseAndValidateUrl('http://user:pass@example.com')).toThrow(UrlSafetyError);
  });

  it('throws for blocked hosts', () => {
    expect(() => parseAndValidateUrl('http://localhost/')).toThrow(UrlSafetyError);
    expect(() => parseAndValidateUrl('http://127.0.0.1/')).toThrow(UrlSafetyError);
  });

  it('returns a URL for valid public addresses', () => {
    const url = parseAndValidateUrl('https://example.com/docs');
    expect(url).toBeInstanceOf(URL);
    expect(url.hostname).toBe('example.com');
  });

  it('denyHosts blocks specified hosts', () => {
    expect(() =>
      parseAndValidateUrl('https://example.com/', { denyHosts: ['example.com'] }),
    ).toThrow(UrlSafetyError);
  });

  it('allowHosts restricts to specified hosts', () => {
    expect(() =>
      parseAndValidateUrl('https://example.com/', { allowHosts: ['other.com'] }),
    ).toThrow(UrlSafetyError);
    const url = parseAndValidateUrl('https://example.com/', { allowHosts: ['example.com'] });
    expect(url.hostname).toBe('example.com');
  });

  it('rejects IPv4-mapped IPv6 literals that resolve to private addresses', () => {
    expect(() => parseAndValidateUrl('http://[::ffff:7f00:1]/')).toThrow(UrlSafetyError);
    expect(() => parseAndValidateUrl('http://[::ffff:0a00:1]/')).toThrow(UrlSafetyError);
  });

  it('accepts a public IPv6 literal', () => {
    const url = parseAndValidateUrl('https://[2606:4700:4700::1111]/');
    expect(url).toBeInstanceOf(URL);
  });
});
