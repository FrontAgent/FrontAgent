/**
 * 文件快照管理器
 * 支持文件修改的快照和回滚
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { generateId } from '@frontagent/shared';

/**
 * 快照记录
 */
export interface Snapshot {
  id: string;
  timestamp: number;
  filePath: string;
  content: string;
  operation: 'create' | 'modify' | 'delete';
  previousContent?: string;
}

/**
 * 快照管理器
 */
export class SnapshotManager {
  private snapshots: Map<string, Snapshot> = new Map();
  private fileSnapshots: Map<string, string[]> = new Map(); // filePath -> snapshotIds
  private snapshotDir: string;

  constructor(projectRoot: string) {
    this.snapshotDir = join(projectRoot, '.frontagent', 'snapshots');
    this.ensureSnapshotDir();
  }

  /**
   * 确保快照目录存在
   */
  private ensureSnapshotDir(): void {
    if (!existsSync(this.snapshotDir)) {
      mkdirSync(this.snapshotDir, { recursive: true });
    }
  }

  /**
   * 创建文件快照（修改前调用）
   */
  createSnapshot(filePath: string, operation: 'create' | 'modify' | 'delete'): string {
    const snapshotId = generateId('snap');
    const timestamp = Date.now();

    let previousContent: string | undefined;
    if (existsSync(filePath) && operation !== 'create') {
      previousContent = readFileSync(filePath, 'utf-8');
    }

    const snapshot: Snapshot = {
      id: snapshotId,
      timestamp,
      filePath,
      content: previousContent ?? '',
      operation,
      previousContent
    };

    // 保存到内存
    this.snapshots.set(snapshotId, snapshot);

    // 记录文件的快照历史
    const fileHistory = this.fileSnapshots.get(filePath) ?? [];
    fileHistory.push(snapshotId);
    this.fileSnapshots.set(filePath, fileHistory);

    // 持久化到磁盘
    this.persistSnapshot(snapshot);

    return snapshotId;
  }

  /**
   * 更新快照的当前内容（修改后调用）
   */
  updateSnapshotContent(snapshotId: string, newContent: string): void {
    const snapshot = this.snapshots.get(snapshotId);
    if (snapshot) {
      snapshot.content = newContent;
      this.persistSnapshot(snapshot);
    }
  }

  /**
   * 回滚到指定快照
   */
  rollback(snapshotId: string): { success: boolean; message: string } {
    const snapshot = this.snapshots.get(snapshotId);
    if (!snapshot) {
      return { success: false, message: `Snapshot not found: ${snapshotId}` };
    }

    try {
      if (snapshot.operation === 'create') {
        // 如果是创建操作，回滚就是删除文件
        if (existsSync(snapshot.filePath)) {
          const { unlinkSync } = require('node:fs');
          unlinkSync(snapshot.filePath);
        }
      } else if (snapshot.previousContent !== undefined) {
        // 恢复之前的内容
        const dir = dirname(snapshot.filePath);
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true });
        }
        writeFileSync(snapshot.filePath, snapshot.previousContent, 'utf-8');
      }

      return { success: true, message: `Rolled back to snapshot ${snapshotId}` };
    } catch (error) {
      return {
        success: false,
        message: `Failed to rollback: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * 回滚文件到最近的快照
   */
  rollbackFile(filePath: string): { success: boolean; message: string } {
    const fileHistory = this.fileSnapshots.get(filePath);
    if (!fileHistory || fileHistory.length === 0) {
      return { success: false, message: `No snapshots found for file: ${filePath}` };
    }

    const latestSnapshotId = fileHistory[fileHistory.length - 1];
    return this.rollback(latestSnapshotId);
  }

  /**
   * 获取文件的所有快照
   */
  getFileSnapshots(filePath: string): Snapshot[] {
    const snapshotIds = this.fileSnapshots.get(filePath) ?? [];
    return snapshotIds
      .map(id => this.snapshots.get(id))
      .filter((s): s is Snapshot => s !== undefined);
  }

  /**
   * 获取指定快照
   */
  getSnapshot(snapshotId: string): Snapshot | undefined {
    return this.snapshots.get(snapshotId);
  }

  /**
   * 清理旧快照（保留最近 N 个）
   */
  cleanup(filePath: string, keepCount: number = 10): void {
    const fileHistory = this.fileSnapshots.get(filePath);
    if (!fileHistory || fileHistory.length <= keepCount) {
      return;
    }

    const toRemove = fileHistory.slice(0, fileHistory.length - keepCount);
    for (const snapshotId of toRemove) {
      this.snapshots.delete(snapshotId);
      // TODO: 删除持久化的快照文件
    }

    this.fileSnapshots.set(filePath, fileHistory.slice(-keepCount));
  }

  /**
   * 持久化快照到磁盘
   */
  private persistSnapshot(snapshot: Snapshot): void {
    const snapshotPath = join(this.snapshotDir, `${snapshot.id}.json`);
    writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2), 'utf-8');
  }

  /**
   * 从磁盘加载快照
   */
  loadSnapshots(): void {
    const { readdirSync } = require('node:fs');
    if (!existsSync(this.snapshotDir)) {
      return;
    }

    const files = readdirSync(this.snapshotDir) as string[];
    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const content = readFileSync(join(this.snapshotDir, file), 'utf-8');
          const snapshot = JSON.parse(content) as Snapshot;
          this.snapshots.set(snapshot.id, snapshot);

          const fileHistory = this.fileSnapshots.get(snapshot.filePath) ?? [];
          fileHistory.push(snapshot.id);
          this.fileSnapshots.set(snapshot.filePath, fileHistory);
        } catch {
          // 忽略无效的快照文件
        }
      }
    }
  }
}

