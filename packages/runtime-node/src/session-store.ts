import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AgentSessionSnapshot } from '@frontagent/core';

/**
 * 会话持久化存储（.frontagent/sessions/<sessionId>.json）
 *
 * 每次运行写入一份可恢复快照（任务、计划、消息历史、事实快照），
 * 步骤完成时更新；fa run --resume 从未完成的会话继续执行。
 */

export type SessionStatus = 'running' | 'completed' | 'failed';

export interface SessionRecord {
  sessionId: string;
  status: SessionStatus;
  createdAt: string;
  updatedAt: string;
  snapshot: AgentSessionSnapshot;
}

export function getSessionsDir(projectRoot: string): string {
  return join(projectRoot, '.frontagent', 'sessions');
}

export function createSessionId(): string {
  return `session-${Date.now()}-${randomUUID().slice(0, 8)}`;
}

export function saveSessionRecord(projectRoot: string, record: SessionRecord): void {
  const dir = getSessionsDir(projectRoot);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, `${record.sessionId}.json`),
    `${JSON.stringify(record, null, 2)}\n`,
    'utf-8',
  );
}

export function loadSessionRecord(
  projectRoot: string,
  sessionId: string,
): SessionRecord | undefined {
  const path = join(getSessionsDir(projectRoot), `${sessionId}.json`);
  try {
    if (!existsSync(path)) return undefined;
    const parsed = JSON.parse(readFileSync(path, 'utf-8')) as SessionRecord;
    if (!parsed?.sessionId || !parsed.snapshot?.plan) return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

export function listSessionRecords(projectRoot: string): SessionRecord[] {
  const dir = getSessionsDir(projectRoot);
  if (!existsSync(dir)) return [];

  const records: SessionRecord[] = [];
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.json')) continue;
    const record = loadSessionRecord(projectRoot, file.slice(0, -'.json'.length));
    if (record) records.push(record);
  }

  return records.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** 最近一个未完成（running）的会话；completed/failed 不参与默认恢复 */
export function findLatestResumableSession(projectRoot: string): SessionRecord | undefined {
  return listSessionRecords(projectRoot).find((record) => record.status === 'running');
}
