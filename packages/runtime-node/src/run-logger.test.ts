import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { AgentEvent } from '@frontagent/core';
import { afterEach, describe, expect, it } from 'vitest';
import { createRunLogger, redactForLog, resolveRunLogPath } from './run-logger.js';

describe('redactForLog', () => {
  describe('string redaction', () => {
    it('redacts Bearer tokens', () => {
      const result = redactForLog('Authorization: Bearer sk-abc123xyz');
      expect(result).toContain('[REDACTED]');
      expect(result).not.toContain('sk-abc123xyz');
    });

    it('redacts CLI --api-key flag', () => {
      const result = redactForLog('run --api-key=my-secret-key --verbose');
      expect(result).not.toContain('my-secret-key');
      expect(result).toContain('[REDACTED]');
    });

    it('redacts CLI --token flag with space separator', () => {
      const result = redactForLog('run --token ghp_abc123');
      expect(result).not.toContain('ghp_abc123');
    });

    it('redacts CLI --password flag', () => {
      const result = redactForLog('login --password=hunter2');
      expect(result).not.toContain('hunter2');
    });

    it('redacts key=value patterns', () => {
      const result = redactForLog('api_key: "sk-proj-abc123"');
      expect(result).not.toContain('sk-proj-abc123');
      expect(result).toContain('[REDACTED]');
    });

    it('redacts token= patterns', () => {
      const result = redactForLog('token=ghp_1234567890abcdef');
      expect(result).not.toContain('ghp_1234567890abcdef');
    });

    it('preserves non-secret content', () => {
      const result = redactForLog('Hello world, status=200');
      expect(result).toBe('Hello world, status=200');
    });
  });

  describe('object redaction', () => {
    it('redacts keys matching secret patterns', () => {
      const result = redactForLog({ apiKey: 'sk-secret', name: 'test' });
      expect(result).toEqual({ apiKey: '[REDACTED]', name: 'test' });
    });

    it('redacts api_key pattern', () => {
      const result = redactForLog({ api_key: 'secret123', host: 'localhost' });
      expect(result).toEqual({ api_key: '[REDACTED]', host: 'localhost' });
    });

    it('redacts token key', () => {
      const result = redactForLog({ token: 'abc', user: 'bob' });
      expect(result).toEqual({ token: '[REDACTED]', user: 'bob' });
    });

    it('redacts authorization key', () => {
      const result = redactForLog({ authorization: 'Bearer xyz' });
      expect(result).toEqual({ authorization: '[REDACTED]' });
    });

    it('redacts password key', () => {
      const result = redactForLog({ password: 'hunter2', username: 'admin' });
      expect(result).toEqual({ password: '[REDACTED]', username: 'admin' });
    });

    it('redacts secret key', () => {
      const result = redactForLog({ clientSecret: 'shh', clientId: 'pub' });
      expect(result).toEqual({ clientSecret: '[REDACTED]', clientId: 'pub' });
    });

    it('redacts credential key', () => {
      const result = redactForLog({ credential: 'cred123', type: 'oauth' });
      expect(result).toEqual({ credential: '[REDACTED]', type: 'oauth' });
    });

    it('redacts nested objects recursively', () => {
      const result = redactForLog({
        config: { apiKey: 'secret', endpoint: 'https://api.example.com' },
      });
      expect(result).toEqual({
        config: { apiKey: '[REDACTED]', endpoint: 'https://api.example.com' },
      });
    });

    it('redacts strings inside nested values', () => {
      const result = redactForLog({
        headers: { value: 'Bearer sk-12345' },
      });
      const headers = (result as Record<string, unknown>).headers as Record<string, unknown>;
      expect(headers.value).not.toContain('sk-12345');
    });
  });

  describe('array redaction', () => {
    it('redacts secrets inside arrays', () => {
      const result = redactForLog([{ apiKey: 'secret' }, { name: 'safe' }]);
      expect(result).toEqual([{ apiKey: '[REDACTED]' }, { name: 'safe' }]);
    });

    it('redacts strings inside arrays', () => {
      const result = redactForLog(['Bearer sk-abc123', 'hello']);
      expect(result).toEqual([expect.stringContaining('[REDACTED]'), 'hello']);
    });
  });

  describe('circular reference handling', () => {
    it('handles circular references without throwing', () => {
      const obj: Record<string, unknown> = { name: 'test' };
      obj.self = obj;
      const result = redactForLog(obj) as Record<string, unknown>;
      expect(result.name).toBe('test');
      expect(result.self).toBe('[Circular]');
    });
  });

  describe('Error object redaction', () => {
    it('redacts secrets in error messages', () => {
      const err = new Error('Failed with token=sk-secret123');
      const result = redactForLog(err) as Record<string, unknown>;
      expect(result.name).toBe('Error');
      expect(result.message).not.toContain('sk-secret123');
      expect(result.message).toContain('[REDACTED]');
    });

    it('preserves error structure', () => {
      const err = new Error('Something went wrong');
      err.stack = 'Error: Something went wrong\n    at test.ts:1:1';
      const result = redactForLog(err) as Record<string, unknown>;
      expect(result.name).toBe('Error');
      expect(result.message).toBe('Something went wrong');
      expect(result.stack).toContain('at test.ts:1:1');
    });
  });

  describe('primitive values', () => {
    it('passes through numbers unchanged', () => {
      expect(redactForLog(42)).toBe(42);
    });

    it('passes through booleans unchanged', () => {
      expect(redactForLog(true)).toBe(true);
    });

    it('passes through null unchanged', () => {
      expect(redactForLog(null)).toBeNull();
    });

    it('passes through undefined unchanged', () => {
      expect(redactForLog(undefined)).toBeUndefined();
    });
  });
});

describe('resolveRunLogPath', () => {
  it('uses custom logFile when provided', () => {
    const result = resolveRunLogPath('/project', 'custom.log');
    expect(result).toBe(resolve('/project', 'custom.log'));
  });

  it('generates path under .frontagent/runs when no logFile', () => {
    const result = resolveRunLogPath('/project');
    expect(result).toMatch(/^\/project\/\.frontagent\/runs\//);
    expect(result).toMatch(/\.log$/);
  });

  it('includes timestamp in generated filename', () => {
    const result = resolveRunLogPath('/project');
    const filename = result.split('/').pop()!;
    expect(filename).toMatch(/^\d{8}T\d{6}Z-/);
  });
});

describe('createRunLogger (file logger)', () => {
  const tempDirs: string[] = [];

  function makeTempDir(): string {
    const dir = mkdtempSync(join(tmpdir(), 'frontagent-runlog-'));
    tempDirs.push(dir);
    return dir;
  }

  function makeLogger(dir = makeTempDir(), task = 'test task', maxBufferedBytes?: number) {
    const logger = createRunLogger({
      projectRoot: dir,
      enabled: true,
      logFile: 'run.log',
      task,
      provider: 'test-provider',
      model: 'test-model',
      options: {},
      maxBufferedBytes,
    });
    if (!logger) throw new Error('expected logger');
    return logger;
  }

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('returns null when disabled', () => {
    expect(
      createRunLogger({
        projectRoot: '/tmp',
        enabled: false,
        task: 't',
        provider: 'p',
        model: 'm',
        options: {},
      }),
    ).toBeNull();
  });

  it('flushes header, entries, and close marker to the log file in order', async () => {
    const logger = makeLogger();
    logger.event({ type: 'stream_token', stepId: 's1', token: 'hello' } as AgentEvent);
    logger.console('warn', ['warned', { apiKey: 'sk-secret' }]);
    logger.result({ success: true } as never);
    logger.error(new Error('boom'));
    await logger.close();

    const content = readFileSync(logger.path, 'utf8');
    expect(content).toContain('# FrontAgent Run Log');
    expect(content).toContain('event.stream_token');
    expect(content).toContain('"tokenLength"');
    expect(content).not.toContain('hello');
    expect(content).toContain('console.warn');
    expect(content).toContain('[REDACTED]');
    expect(content).not.toContain('sk-secret');
    expect(content).toContain('result');
    expect(content).toContain('boom');
    expect(content.indexOf('# FrontAgent Run Log')).toBeLessThan(
      content.indexOf('event.stream_token'),
    );
    expect(content.indexOf('event.stream_token')).toBeLessThan(content.indexOf('console.warn'));
    expect(content.trimEnd().endsWith('closed')).toBe(true);
  });

  it('ignores writes after close and is idempotent on close', async () => {
    const logger = makeLogger();
    logger.event({ type: 'status_update', label: 'before' } as AgentEvent);
    // A large entry keeps the stream flushing while close() is called twice:
    // both calls must share the flush, so awaiting only the second promise
    // still guarantees the file is complete.
    logger.console('log', ['x'.repeat(256 * 1024)]);
    const first = logger.close();
    const second = logger.close();
    expect(second).toBe(first);
    await second;
    logger.event({ type: 'status_update', label: 'after-close' } as AgentEvent);
    logger.console('log', ['after-close-console']);

    const content = readFileSync(logger.path, 'utf8');
    expect(content).toContain('x'.repeat(256 * 1024));
    expect(content).toContain('before');
    expect(content).not.toContain('after-close');
    expect(content.match(/closed/g)).toHaveLength(1);
  });

  it('appends to an existing file instead of truncating', async () => {
    const dir = makeTempDir();
    const path = resolve(dir, 'run.log');

    const first = makeLogger(dir, 'first');
    await first.close();

    const second = makeLogger(dir, 'second');
    await second.close();

    const content = readFileSync(path, 'utf8');
    expect((content.match(/closed/g) ?? []).length).toBe(2);
    expect(content).toContain('"task": "first"');
    expect(content).toContain('"task": "second"');
  });

  it('close() resolves only after all buffered entries are flushed to disk', async () => {
    const logger = makeLogger();
    logger.console('log', ['x'.repeat(256 * 1024)]);
    await logger.close();

    // No polling: the file must be complete the moment close() resolves.
    const content = readFileSync(logger.path, 'utf8');
    expect(content).toContain('x'.repeat(256 * 1024));
    expect(content.trimEnd().endsWith('closed')).toBe(true);
  });

  it('drops droppable entries instead of queueing once the write buffer exceeds the cap', async () => {
    // 64 KB cap: one 100 KB entry saturates the buffer within this tick, so
    // droppable entries written synchronously afterwards are dropped, not queued.
    const logger = makeLogger(makeTempDir(), 'backpressure', 64 * 1024);
    logger.console('log', [`first:${'x'.repeat(100 * 1024)}`]);
    logger.console('log', ['dropped-console-log']);
    logger.event({ type: 'stream_token', stepId: 's1', token: 'dropped-token' } as AgentEvent);
    await logger.close();

    const content = readFileSync(logger.path, 'utf8');
    expect(content).toContain('first:');
    expect(content).not.toContain('dropped-console-log');
    expect(content).not.toContain('event.stream_token');
    expect(content).toContain('dropped 2 log entries while the write buffer was saturated');
    expect(content.trimEnd().endsWith('closed')).toBe(true);
  });

  it('always writes terminal diagnostics even when the buffer is saturated', async () => {
    const logger = makeLogger(makeTempDir(), 'backpressure-terminal', 64 * 1024);
    logger.console('log', [`first:${'x'.repeat(100 * 1024)}`]);
    logger.event({ type: 'stream_token', stepId: 's1', token: 'dropped-token' } as AgentEvent);
    logger.console('error', ['critical-stderr']);
    logger.event({ type: 'task_failed', error: 'terminal-failure' } as AgentEvent);
    logger.error(new Error('boom-after-saturation'));
    logger.result({ success: false } as never);
    await logger.close();

    const content = readFileSync(logger.path, 'utf8');
    expect(content).toContain('critical-stderr');
    expect(content).toContain('event.task_failed');
    expect(content).toContain('terminal-failure');
    expect(content).toContain('boom-after-saturation');
    expect(content).toContain('"success": false');
    // The dropped stream_token is reported before the next non-droppable write.
    expect(content).toContain('dropped 1 log entries while the write buffer was saturated');
    expect(content.trimEnd().endsWith('closed')).toBe(true);
  });
});
