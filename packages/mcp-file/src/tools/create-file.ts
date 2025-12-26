/**
 * create_file 工具
 * 创建新文件
 */

import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import type { SnapshotManager } from '../snapshot.js';

export interface CreateFileParams {
  path: string;
  content: string;
  overwrite?: boolean;
}

export interface CreateFileResult {
  success: boolean;
  path?: string;
  snapshotId?: string;
  error?: string;
}

/**
 * 创建文件
 */
export function createFile(
  params: CreateFileParams,
  projectRoot: string,
  snapshotManager: SnapshotManager
): CreateFileResult {
  const { path: filePath, content, overwrite = false } = params;

  // 解析完整路径
  const fullPath = resolve(projectRoot, filePath);

  // 安全检查
  if (!fullPath.startsWith(projectRoot)) {
    return {
      success: false,
      error: `Access denied: Path is outside project root`
    };
  }

  // 检查文件是否已存在
  if (existsSync(fullPath) && !overwrite) {
    return {
      success: false,
      error: `File already exists: ${filePath}. Set overwrite=true to overwrite.`
    };
  }

  // 创建快照
  const snapshotId = snapshotManager.createSnapshot(fullPath, 'create');

  try {
    // 确保目录存在
    const dir = dirname(fullPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // 写入文件
    writeFileSync(fullPath, content, 'utf-8');
    snapshotManager.updateSnapshotContent(snapshotId, content);

    return {
      success: true,
      path: filePath,
      snapshotId
    };
  } catch (error) {
    // 回滚快照
    snapshotManager.rollback(snapshotId);
    
    return {
      success: false,
      error: `Failed to create file: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * 工具的 JSON Schema 定义
 */
export const createFileSchema = {
  name: 'create_file',
  description: '创建新文件。如果目录不存在会自动创建。',
  inputSchema: {
    type: 'object' as const,
    properties: {
      path: {
        type: 'string',
        description: '相对于项目根目录的文件路径'
      },
      content: {
        type: 'string',
        description: '文件内容'
      },
      overwrite: {
        type: 'boolean',
        description: '是否覆盖已存在的文件，默认 false',
        default: false
      }
    },
    required: ['path', 'content']
  }
};

