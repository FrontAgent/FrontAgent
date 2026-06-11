import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AgentSessionSnapshot } from '@frontagent/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createSessionId,
  findLatestResumableSession,
  getSessionsDir,
  listSessionRecords,
  loadSessionRecord,
  type SessionRecord,
  saveSessionRecord,
} from './session-store.js';

function makeSnapshot(overrides: Partial<AgentSessionSnapshot> = {}): AgentSessionSnapshot {
  return {
    taskId: 'task-1',
    taskDescription: 'build a page',
    taskType: 'create',
    plan: {
      steps: [
        {
          stepId: 's1',
          description: 'step one',
          action: 'read_file',
          tool: 'read_file',
          params: { path: 'a.ts' },
          dependencies: [],
          validation: [],
          status: 'completed',
        },
        {
          stepId: 's2',
          description: 'step two',
          action: 'create_file',
          tool: 'create_file',
          params: { path: 'b.ts' },
          dependencies: ['s1'],
          validation: [],
          status: 'pending',
        },
      ],
      reasoning: 'plan',
      estimatedDuration: 1000,
    },
    messages: [{ role: 'user', content: 'hello' }],
    ...overrides,
  };
}

function makeRecord(overrides: Partial<SessionRecord> = {}): SessionRecord {
  const now = new Date().toISOString();
  return {
    sessionId: createSessionId(),
    status: 'running',
    createdAt: now,
    updatedAt: now,
    snapshot: makeSnapshot(),
    ...overrides,
  };
}

describe('session store', () => {
  let projectRoot: string;

  beforeEach(() => {
    projectRoot = mkdtempSync(join(tmpdir(), 'fa-sessions-'));
  });

  afterEach(() => {
    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('round-trips a session record', () => {
    const record = makeRecord();
    saveSessionRecord(projectRoot, record);

    const loaded = loadSessionRecord(projectRoot, record.sessionId);
    expect(loaded).toEqual(record);
    expect(loaded?.snapshot.plan.steps).toHaveLength(2);
    expect(loaded?.snapshot.plan.steps[0].status).toBe('completed');
  });

  it('returns undefined for unknown or corrupt sessions', () => {
    expect(loadSessionRecord(projectRoot, 'missing')).toBeUndefined();
    expect(getSessionsDir(projectRoot)).toContain('.frontagent');
  });

  it('drops half-written records missing required fields and keeps resume working', () => {
    const good = makeRecord({ sessionId: 'session-good', status: 'running' });
    saveSessionRecord(projectRoot, good);

    const base = makeRecord({ sessionId: 'ignored' });
    const broken: Array<[string, unknown]> = [
      [
        'session-no-updated-at',
        { ...base, sessionId: 'session-no-updated-at', updatedAt: undefined },
      ],
      ['session-bad-status', { ...base, sessionId: 'session-bad-status', status: 'paused' }],
      [
        'session-no-messages',
        {
          ...base,
          sessionId: 'session-no-messages',
          snapshot: { ...base.snapshot, messages: undefined },
        },
      ],
      [
        'session-bad-steps',
        {
          ...base,
          sessionId: 'session-bad-steps',
          snapshot: { ...base.snapshot, plan: { steps: [{ notAStep: true }] } },
        },
      ],
      ['session-not-json', '{ definitely not json'],
    ];
    mkdirSync(getSessionsDir(projectRoot), { recursive: true });
    for (const [id, content] of broken) {
      writeFileSync(
        join(getSessionsDir(projectRoot), `${id}.json`),
        typeof content === 'string' ? content : JSON.stringify(content),
      );
    }

    for (const [id] of broken) {
      expect(loadSessionRecord(projectRoot, id)).toBeUndefined();
    }
    expect(listSessionRecords(projectRoot).map((r) => r.sessionId)).toEqual(['session-good']);
    expect(findLatestResumableSession(projectRoot)?.sessionId).toBe('session-good');
  });

  it('rejects session ids containing path fragments', () => {
    const record = makeRecord({ sessionId: 'session-good' });
    saveSessionRecord(projectRoot, record);

    for (const evil of ['../session-good', 'a/b', '..\\x', '', '  ', 'id.with.dots', '..']) {
      expect(loadSessionRecord(projectRoot, evil)).toBeUndefined();
    }

    // save 对非法 id 直接拒绝，不产生 sessions 目录外的写入
    saveSessionRecord(projectRoot, { ...record, sessionId: '../escape' });
    expect(existsSync(join(projectRoot, '.frontagent', 'escape.json'))).toBe(false);
    expect(existsSync(join(projectRoot, 'escape.json'))).toBe(false);
  });

  it('writes atomically and leaves no temp files behind', () => {
    const record = makeRecord({ sessionId: 'session-atomic' });
    saveSessionRecord(projectRoot, record);
    saveSessionRecord(projectRoot, { ...record, status: 'completed' });

    const files = readdirSync(getSessionsDir(projectRoot));
    expect(files).toEqual(['session-atomic.json']);
    expect(loadSessionRecord(projectRoot, 'session-atomic')?.status).toBe('completed');
  });

  it('lists sessions newest-first and finds the latest resumable one', () => {
    const done = makeRecord({
      sessionId: 'session-done',
      status: 'completed',
      updatedAt: '2026-06-11T10:00:00.000Z',
    });
    const older = makeRecord({
      sessionId: 'session-older',
      status: 'running',
      updatedAt: '2026-06-11T08:00:00.000Z',
    });
    const newer = makeRecord({
      sessionId: 'session-newer',
      status: 'running',
      updatedAt: '2026-06-11T09:00:00.000Z',
    });
    for (const record of [done, older, newer]) {
      saveSessionRecord(projectRoot, record);
    }

    const listed = listSessionRecords(projectRoot);
    expect(listed.map((item) => item.sessionId)).toEqual([
      'session-done',
      'session-newer',
      'session-older',
    ]);

    // completed 会话不参与默认恢复
    expect(findLatestResumableSession(projectRoot)?.sessionId).toBe('session-newer');
  });

  it('returns undefined when no resumable session exists', () => {
    saveSessionRecord(projectRoot, makeRecord({ status: 'completed' }));
    expect(findLatestResumableSession(projectRoot)).toBeUndefined();
  });
});
