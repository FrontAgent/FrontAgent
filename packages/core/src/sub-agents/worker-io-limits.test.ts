import { PassThrough } from 'node:stream';
import { describe, expect, it } from 'vitest';
import {
  BoundedStreamBuffer,
  DEFAULT_MAX_WORKER_IO_BYTES,
  readStreamWithLimit,
} from './worker-io-limits.js';

describe('BoundedStreamBuffer', () => {
  it('accumulates chunks below the limit', () => {
    const buffer = new BoundedStreamBuffer(1024);
    expect(buffer.append('hello ')).toBe(true);
    expect(buffer.append(Buffer.from('world'))).toBe(true);
    expect(buffer.text).toBe('hello world');
    expect(buffer.exceeded).toBe(false);
  });

  it('marks exceeded and keeps only the tail once the byte limit is crossed', () => {
    const buffer = new BoundedStreamBuffer(16, 8);
    expect(buffer.append('a'.repeat(12))).toBe(true);
    expect(buffer.append('b'.repeat(12))).toBe(false);
    expect(buffer.exceeded).toBe(true);
    // Tail keeps only the last `tailChars` characters.
    expect(buffer.text).toBe('bbbbbbbb');
  });

  it('ignores appends after the limit was exceeded', () => {
    const buffer = new BoundedStreamBuffer(4, 4);
    expect(buffer.append('abcdef')).toBe(false);
    expect(buffer.append('ghij')).toBe(false);
    expect(buffer.text).toBe('cdef');
  });

  it('counts multi-byte characters by byte length, not string length', () => {
    const buffer = new BoundedStreamBuffer(5, 8);
    // '你好' is 6 bytes in UTF-8 but 2 chars.
    expect(buffer.append('你好')).toBe(false);
    expect(buffer.exceeded).toBe(true);
  });

  it('exposes a default 4 MB limit constant', () => {
    expect(DEFAULT_MAX_WORKER_IO_BYTES).toBe(4 * 1024 * 1024);
  });
});

describe('readStreamWithLimit', () => {
  it('resolves with the full text when under the limit', async () => {
    const stream = new PassThrough();
    const promise = readStreamWithLimit(stream, 1024);
    stream.write('{"ok":');
    stream.write('true}');
    stream.end();
    await expect(promise).resolves.toBe('{"ok":true}');
  });

  it('rejects when input exceeds the byte limit (worker stdin direction)', async () => {
    const stream = new PassThrough();
    const promise = readStreamWithLimit(stream, 16);
    stream.write('x'.repeat(32));
    await expect(promise).rejects.toThrow(/exceeded 16 bytes/);
  });

  it('rejects on stream error', async () => {
    const stream = new PassThrough();
    const promise = readStreamWithLimit(stream, 1024);
    stream.destroy(new Error('boom'));
    await expect(promise).rejects.toThrow('boom');
  });
});
