/**
 * list_directory 工具
 * 列出目录内容
 */

import { readdirSync, statSync, existsSync } from 'node:fs';
import { resolve, relative, join } from 'node:path';

export interface ListDirectoryParams {
  path: string;
  recursive?: boolean;
  includeHidden?: boolean;
  maxDepth?: number;
}

export interface FileInfo {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  modifiedAt?: string;
}

export interface ListDirectoryResult {
  success: boolean;
  entries?: FileInfo[];
  error?: string;
}

/**
 * 列出目录内容
 */
export function listDirectory(
  params: ListDirectoryParams,
  projectRoot: string
): ListDirectoryResult {
  const { path: dirPath, recursive = false, includeHidden = false, maxDepth = 3 } = params;

  // 解析完整路径
  const fullPath = resolve(projectRoot, dirPath);

  // 安全检查
  if (!fullPath.startsWith(projectRoot)) {
    return {
      success: false,
      error: `Access denied: Path is outside project root`
    };
  }

  // 检查目录是否存在
  if (!existsSync(fullPath)) {
    return {
      success: false,
      error: `Directory not found: ${dirPath}`
    };
  }

  // 检查是否是目录
  const stat = statSync(fullPath);
  if (!stat.isDirectory()) {
    return {
      success: false,
      error: `Not a directory: ${dirPath}`
    };
  }

  try {
    const entries = listRecursive(fullPath, projectRoot, recursive, includeHidden, 0, maxDepth);
    return {
      success: true,
      entries
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to list directory: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * 递归列出目录
 */
function listRecursive(
  dirPath: string,
  projectRoot: string,
  recursive: boolean,
  includeHidden: boolean,
  currentDepth: number,
  maxDepth: number
): FileInfo[] {
  const entries: FileInfo[] = [];

  // 忽略的目录
  const ignoreDirs = ['node_modules', '.git', 'dist', 'build', 'coverage', '.next', '.nuxt'];

  const items = readdirSync(dirPath);

  for (const item of items) {
    // 跳过隐藏文件
    if (!includeHidden && item.startsWith('.')) {
      continue;
    }

    const itemPath = join(dirPath, item);
    const itemStat = statSync(itemPath);
    const relativePath = relative(projectRoot, itemPath);

    const fileInfo: FileInfo = {
      name: item,
      path: relativePath,
      type: itemStat.isDirectory() ? 'directory' : 'file'
    };

    if (itemStat.isFile()) {
      fileInfo.size = itemStat.size;
      fileInfo.modifiedAt = itemStat.mtime.toISOString();
    }

    entries.push(fileInfo);

    // 递归处理子目录
    if (
      recursive &&
      itemStat.isDirectory() &&
      !ignoreDirs.includes(item) &&
      currentDepth < maxDepth
    ) {
      const subEntries = listRecursive(
        itemPath,
        projectRoot,
        recursive,
        includeHidden,
        currentDepth + 1,
        maxDepth
      );
      entries.push(...subEntries);
    }
  }

  return entries;
}

/**
 * 工具的 JSON Schema 定义
 */
export const listDirectorySchema = {
  name: 'list_directory',
  description: '列出目录内容。可以递归列出子目录。',
  inputSchema: {
    type: 'object' as const,
    properties: {
      path: {
        type: 'string',
        description: '相对于项目根目录的目录路径'
      },
      recursive: {
        type: 'boolean',
        description: '是否递归列出子目录，默认 false',
        default: false
      },
      includeHidden: {
        type: 'boolean',
        description: '是否包含隐藏文件（以 . 开头），默认 false',
        default: false
      },
      maxDepth: {
        type: 'number',
        description: '递归时的最大深度，默认 3',
        default: 3
      }
    },
    required: ['path']
  }
};

