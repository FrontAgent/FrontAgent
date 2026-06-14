import { describe, expect, it } from 'vitest';
import {
  clampLimit,
  DEFAULT_MAX_BYTES,
  DEFAULT_TIMEOUT_MS,
  HARD_MAX_BYTES,
  HARD_MAX_TIMEOUT_MS,
} from './engine.js';
import { isConnectionAddressBlocked } from './url-safety.js';

describe('clampLimit', () => {
  it('returns the default for non-number values', () => {
    expect(clampLimit('15000', DEFAULT_TIMEOUT_MS, HARD_MAX_TIMEOUT_MS)).toBe(DEFAULT_TIMEOUT_MS);
    expect(clampLimit(undefined, DEFAULT_TIMEOUT_MS, HARD_MAX_TIMEOUT_MS)).toBe(DEFAULT_TIMEOUT_MS);
    expect(clampLimit(null, DEFAULT_TIMEOUT_MS, HARD_MAX_TIMEOUT_MS)).toBe(DEFAULT_TIMEOUT_MS);
  });

  it('returns the default for NaN, zero, negative, and non-finite values', () => {
    expect(clampLimit(Number.NaN, DEFAULT_MAX_BYTES, HARD_MAX_BYTES)).toBe(DEFAULT_MAX_BYTES);
    expect(clampLimit(0, DEFAULT_MAX_BYTES, HARD_MAX_BYTES)).toBe(DEFAULT_MAX_BYTES);
    expect(clampLimit(-1, DEFAULT_MAX_BYTES, HARD_MAX_BYTES)).toBe(DEFAULT_MAX_BYTES);
    expect(clampLimit(Number.POSITIVE_INFINITY, DEFAULT_MAX_BYTES, HARD_MAX_BYTES)).toBe(
      DEFAULT_MAX_BYTES,
    );
    expect(clampLimit(Number.NEGATIVE_INFINITY, DEFAULT_MAX_BYTES, HARD_MAX_BYTES)).toBe(
      DEFAULT_MAX_BYTES,
    );
  });

  it('floors fractional values', () => {
    expect(clampLimit(10.7, DEFAULT_TIMEOUT_MS, HARD_MAX_TIMEOUT_MS)).toBe(10);
  });

  it('caps values above the hard maximum', () => {
    expect(clampLimit(100_000, DEFAULT_TIMEOUT_MS, HARD_MAX_TIMEOUT_MS)).toBe(HARD_MAX_TIMEOUT_MS);
    expect(clampLimit(10_000_000, DEFAULT_MAX_BYTES, HARD_MAX_BYTES)).toBe(HARD_MAX_BYTES);
  });

  it('passes through valid in-range values', () => {
    expect(clampLimit(5000, DEFAULT_TIMEOUT_MS, HARD_MAX_TIMEOUT_MS)).toBe(5000);
    expect(clampLimit(1_000_000, DEFAULT_MAX_BYTES, HARD_MAX_BYTES)).toBe(1_000_000);
  });
});

describe('isConnectionAddressBlocked', () => {
  it('blocks private/loopback/link-local IPv4 addresses', () => {
    expect(isConnectionAddressBlocked('127.0.0.1')).toBe(true);
    expect(isConnectionAddressBlocked('10.0.0.1')).toBe(true);
    expect(isConnectionAddressBlocked('169.254.169.254')).toBe(true);
    expect(isConnectionAddressBlocked('192.168.1.1')).toBe(true);
  });

  it('blocks private/loopback/link-local IPv6 addresses', () => {
    expect(isConnectionAddressBlocked('::1')).toBe(true);
    expect(isConnectionAddressBlocked('fe80::1')).toBe(true);
    expect(isConnectionAddressBlocked('fc00::1')).toBe(true);
  });

  it('allows public addresses', () => {
    expect(isConnectionAddressBlocked('8.8.8.8')).toBe(false);
    expect(isConnectionAddressBlocked('2606:4700::1')).toBe(false);
  });
});
