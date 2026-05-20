import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { redactForLog, resolveRunLogPath } from './run-logger.js';

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
