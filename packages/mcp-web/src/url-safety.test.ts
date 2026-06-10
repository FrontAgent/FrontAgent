import { describe, expect, it } from 'vitest';
import { checkUrlSafety } from './url-safety.js';

describe('checkUrlSafety', () => {
  it('allows http and https', () => {
    expect(checkUrlSafety('http://example.com').ok).toBe(true);
    expect(checkUrlSafety('https://example.com/page').ok).toBe(true);
  });

  it('allows localhost dev servers by default', () => {
    expect(checkUrlSafety('http://localhost:3000').ok).toBe(true);
    expect(checkUrlSafety('http://127.0.0.1:5173').ok).toBe(true);
    expect(checkUrlSafety('http://192.168.1.10:8080').ok).toBe(true);
  });

  it('blocks non-http(s) schemes', () => {
    expect(checkUrlSafety('file:///etc/passwd').ok).toBe(false);
    expect(checkUrlSafety('javascript:alert(1)').ok).toBe(false);
    expect(checkUrlSafety('data:text/html,<h1>x</h1>').ok).toBe(false);
    expect(checkUrlSafety('ftp://example.com').ok).toBe(false);
  });

  it('always blocks the cloud metadata / link-local range', () => {
    expect(checkUrlSafety('http://169.254.169.254/latest/meta-data/').ok).toBe(false);
    expect(checkUrlSafety('http://169.254.1.1/').ok).toBe(false);
    expect(checkUrlSafety('http://metadata.google.internal/').ok).toBe(false);
    expect(checkUrlSafety('http://[fe80::1]/').ok).toBe(false);
  });

  it('blocks alternate encodings of the metadata IP', () => {
    // decimal, hex, octal, partial and trailing-dot forms of 169.254.169.254
    expect(checkUrlSafety('http://2852039166/').ok).toBe(false);
    expect(checkUrlSafety('http://0xA9FEA9FE/').ok).toBe(false);
    expect(checkUrlSafety('http://0251.0376.0251.0376/').ok).toBe(false);
    expect(checkUrlSafety('http://169.254.43518/').ok).toBe(false);
    expect(checkUrlSafety('http://0xa9.254.169.254/').ok).toBe(false);
    expect(checkUrlSafety('http://169.254.169.254./').ok).toBe(false);
  });

  it('blocks alternate encodings of private addresses in strict mode', () => {
    const strict = { blockPrivate: true };
    expect(checkUrlSafety('http://2130706433/', strict).ok).toBe(false); // 127.0.0.1
    expect(checkUrlSafety('http://0x7f000001/', strict).ok).toBe(false); // 127.0.0.1
    expect(checkUrlSafety('http://017700000001/', strict).ok).toBe(false); // 127.0.0.1
    expect(checkUrlSafety('http://0xC0A80101/', strict).ok).toBe(false); // 192.168.1.1
  });

  it('rejects malformed URLs', () => {
    expect(checkUrlSafety('not a url').ok).toBe(false);
    expect(checkUrlSafety('').ok).toBe(false);
  });

  it('blocks loopback and private ranges in strict mode', () => {
    const strict = { blockPrivate: true };
    expect(checkUrlSafety('http://localhost:3000', strict).ok).toBe(false);
    expect(checkUrlSafety('http://127.0.0.1', strict).ok).toBe(false);
    expect(checkUrlSafety('http://10.0.0.5', strict).ok).toBe(false);
    expect(checkUrlSafety('http://172.16.0.1', strict).ok).toBe(false);
    expect(checkUrlSafety('http://192.168.0.1', strict).ok).toBe(false);
    expect(checkUrlSafety('http://[::1]/', strict).ok).toBe(false);
    expect(checkUrlSafety('https://example.com', strict).ok).toBe(true);
  });
});
