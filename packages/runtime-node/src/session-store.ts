import { randomUUID } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
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

/**
 * sessionId 是用户输入边界（fa run --resume <id>）：只接受内部生成格式的
 * 字符集，杜绝路径分隔符与 ..，使读写永远落在 sessions 目录内。
 */
export function isSafeSessionId(sessionId: unknown): sessionId is string {
  return typeof sessionId === 'string' && /^[A-Za-z0-9_-]+$/.test(sessionId);
}

export function saveSessionRecord(projectRoot: string, record: SessionRecord): void {
  if (!isSafeSessionId(record.sessionId)) return;

  const dir = getSessionsDir(projectRoot);
  mkdirSync(dir, { recursive: true });

  // 原子落盘：先写同目录临时文件再 rename，崩溃/中断不会破坏上一份完整快照
  const targetPath = join(dir, `${record.sessionId}.json`);
  const tmpPath = join(dir, `.${record.sessionId}.${randomUUID().slice(0, 8)}.tmp`);
  try {
    writeFileSync(tmpPath, `${JSON.stringify(record, null, 2)}\n`, 'utf-8');
    renameSync(tmpPath, targetPath);
  } catch (error) {
    rmSync(tmpPath, { force: true });
    throw error;
  }
}

const SESSION_STATUSES: ReadonlySet<string> = new Set(['running', 'completed', 'failed']);

/**
 * 完整的会话记录 schema 校验：session-store 是恢复数据的唯一校验入口，
 * 历史版本、手工修改或半写入的文件在这里被丢弃，不流入恢复路径。
 */
function isValidSessionRecord(value: unknown): value is SessionRecord {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Partial<SessionRecord>;

  if (!isSafeSessionId(record.sessionId)) return false;
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
  if (snapshot.plan.steps.some((step) => !isValidExecutionStep(step))) return false;

  if (snapshot.files !== undefined) {
    if (typeof snapshot.files !== 'object' || snapshot.files === null) return false;
    if (Object.values(snapshot.files).some((content) => typeof content !== 'string')) return false;
  }

  return true;
}

/**
 * 执行器消费 step 的最小运行契约：缺少 dependencies/params 等字段的
 * 损坏快照在加载阶段被丢弃，而不是在 phase runner 里抛执行期异常。
 */
function isValidExecutionStep(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const step = value as Record<string, unknown>;

  if (typeof step.stepId !== 'string' || step.stepId === '') return false;
  if (typeof step.description !== 'string') return false;
  if (typeof step.action !== 'string' || typeof step.tool !== 'string') return false;
  if (typeof step.params !== 'object' || step.params === null || Array.isArray(step.params)) {
    return false;
  }
  if (
    !Array.isArray(step.dependencies) ||
    step.dependencies.some((dep) => typeof dep !== 'string')
  ) {
    return false;
  }
  if (!Array.isArray(step.validation)) return false;
  if (typeof step.status !== 'string') return false;

  return true;
}

export function loadSessionRecord(
  projectRoot: string,
  sessionId: string,
): SessionRecord | undefined {
  if (!isSafeSessionId(sessionId)) return undefined;

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

/**
 * 最近一个可恢复的会话：只有 completed 被排除——
 * 中断（running）与失败（failed）的最新快照都可以用 --resume 继续
 */
export function findLatestResumableSession(projectRoot: string): SessionRecord | undefined {
  return listSessionRecords(projectRoot).find((record) => record.status !== 'completed');
}
