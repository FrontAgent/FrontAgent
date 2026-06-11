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

const SESSION_STATUSES: ReadonlySet<string> = new Set(['running', 'completed', 'failed']);

/**
 * 完整的会话记录 schema 校验：session-store 是恢复数据的唯一校验入口，
 * 历史版本、手工修改或半写入的文件在这里被丢弃，不流入恢复路径。
 */
function isValidSessionRecord(value: unknown): value is SessionRecord {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Partial<SessionRecord>;

  if (typeof record.sessionId !== 'string' || record.sessionId === '') return false;
  if (typeof record.status !== 'string' || !SESSION_STATUSES.has(record.status)) return false;
  if (typeof record.createdAt !== 'string' || typeof record.updatedAt !== 'string') return false;

  const snapshot = record.snapshot as Partial<SessionRecord['snapshot']> | undefined;
  if (typeof snapshot !== 'object' || snapshot === null) return false;
  if (typeof snapshot.taskDescription !== 'string') return false;
  if (typeof snapshot.taskType !== 'string') return false;
  if (!Array.isArray(snapshot.messages)) return false;
  if (
    snapshot.messages.some(
      (message) =>
        typeof message !== 'object' ||
        message === null ||
        typeof (message as { role?: unknown }).role !== 'string' ||
        typeof (message as { content?: unknown }).content !== 'string',
    )
  ) {
    return false;
  }
  if (typeof snapshot.plan !== 'object' || snapshot.plan === null) return false;
  if (!Array.isArray(snapshot.plan.steps)) return false;
  if (
    snapshot.plan.steps.some(
      (step) =>
        typeof step !== 'object' ||
        step === null ||
        typeof (step as { stepId?: unknown }).stepId !== 'string' ||
        typeof (step as { status?: unknown }).status !== 'string',
    )
  ) {
    return false;
  }

  return true;
}

export function loadSessionRecord(
  projectRoot: string,
  sessionId: string,
): SessionRecord | undefined {
  const path = join(getSessionsDir(projectRoot), `${sessionId}.json`);
  try {
    if (!existsSync(path)) return undefined;
    const parsed = JSON.parse(readFileSync(path, 'utf-8')) as unknown;
    return isValidSessionRecord(parsed) ? parsed : undefined;
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
