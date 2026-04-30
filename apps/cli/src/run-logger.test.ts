import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createRunLogger, redactForLog, resolveRunLogPath } from './run-logger.js';

const tempRoots: string[] = [];

function createTempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'frontagent-run-log-'));
  tempRoots.push(root);
  return root;
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe('run logger', () => {
  it('creates the default run log path under .frontagent/runs', () => {
    const root = createTempRoot();
    const path = resolveRunLogPath(root);

    expect(path.startsWith(join(root, '.frontagent', 'runs'))).toBe(true);
    expect(path.endsWith('.log')).toBe(true);
  });

  it('writes redacted headers, events, console output, and errors', () => {
    const root = createTempRoot();
    const logger = createRunLogger({
      projectRoot: root,
      enabled: true,
      task: 'demo',
      provider: 'openai',
      model: 'test-model',
      baseURL: 'https://example.com/v1',
      options: {
        apiKey: 'sk-secret-value',
        nested: { token: 'nested-token-value' },
      },
    });

    expect(logger).not.toBeNull();
    logger!.console('log', ['hello', { apiKey: 'console-secret-value' }]);
    logger!.event({ type: 'status_update', label: '生成最终回答', operation: 'LLM' });
    logger!.error(new Error('authorization: Bearer bearer-secret-value'));
    logger!.close();

    const content = readFileSync(logger!.path, 'utf8');
    expect(content).toContain('FrontAgent Run Log');
    expect(content).toContain('event.status_update');
    expect(content).toContain('生成最终回答');
    expect(content).toContain('[REDACTED]');
    expect(content).not.toContain('sk-secret-value');
    expect(content).not.toContain('nested-token-value');
    expect(content).not.toContain('console-secret-value');
    expect(content).not.toContain('bearer-secret-value');
  });

  it('does not create a logger when run logging is disabled', () => {
    const root = createTempRoot();
    const logger = createRunLogger({
      projectRoot: root,
      enabled: false,
      task: 'demo',
      provider: 'openai',
      model: 'test-model',
      options: {},
    });

    expect(logger).toBeNull();
    expect(existsSync(join(root, '.frontagent'))).toBe(false);
  });

  it('redacts secret-like object keys recursively', () => {
    expect(redactForLog({ ok: 'visible', credential: 'hidden' })).toEqual({
      ok: 'visible',
      credential: '[REDACTED]',
    });
  });
});
