/**
 * list_directory 工具
 * 列出目录内容
 */

import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { getRealProjectRoot, resolveReadPath } from '../path-safety.js';

export interface ListDirectoryParams {
  path: string;
  recursive?: boolean;
  includeHidden?: boolean;
  maxDepth?: number;
  maxEntries?: number;
}

const DEFAULT_MAX_DEPTH = 3;
const MAX_DEPTH_LIMIT = 10;
const DEFAULT_MAX_ENTRIES = 2000;
const MAX_ENTRIES_LIMIT = 2000;

interface TraversalBudget {
  remaining: number;
  omitted: number;
}

function normalizePositiveInteger(
  value: number | undefined,
  name: string,
  defaultValue: number,
  limit: number,
): { ok: true; value: number } | { ok: false; error: string } {
  if (value === undefined) {
    return { ok: true, value: defaultValue };
  }
  if (!Number.isInteger(value) || value < 1) {
    return { ok: false, error: `${name} must be a positive integer, got: ${value}` };
  }
  return { ok: true, value: Math.min(value, limit) };
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
  truncated?: boolean;
  omittedEntries?: number;
  error?: string;
}

/**
 * 列出目录内容
 */
export function listDirectory(
  params: ListDirectoryParams,
  projectRoot: string,
): ListDirectoryResult {
  const { path: dirPath, recursive = false, includeHidden = false } = params;

  const maxDepth = normalizePositiveInteger(
    params.maxDepth,
    'maxDepth',
    DEFAULT_MAX_DEPTH,
    MAX_DEPTH_LIMIT,
  );
  if (!maxDepth.ok) {
    return { success: false, error: maxDepth.error };
  }
  const maxEntries = normalizePositiveInteger(
    params.maxEntries,
    'maxEntries',
    DEFAULT_MAX_ENTRIES,
    MAX_ENTRIES_LIMIT,
  );
  if (!maxEntries.ok) {
    return { success: false, error: maxEntries.error };
  }

  const safePath = resolveReadPath(dirPath, projectRoot);
  if (!safePath.ok) {
    return {
      success: false,
      error: safePath.error,
    };
  }

  // 检查是否是目录
  const stat = statSync(safePath.fullPath);
  if (!stat.isDirectory()) {
    return {
      success: false,
      error: `Not a directory: ${dirPath}`,
    };
  }

  try {
    const budget: TraversalBudget = { remaining: maxEntries.value, omitted: 0 };
    const entries = listRecursive(
      safePath.fullPath,
      getRealProjectRoot(projectRoot),
      recursive,
      includeHidden,
      0,
      maxDepth.value,
      budget,
    );
    return {
      success: true,
      entries,
      truncated: budget.omitted > 0,
      ...(budget.omitted > 0 ? { omittedEntries: budget.omitted } : {}),
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to list directory: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * 递归列出目录
 *
 * 共享的 budget 会在收集满 maxEntries 后停止收集，
 * 但继续遍历（同样的深度/忽略规则）以统计被省略的条目数。
 */
function listRecursive(
  dirPath: string,
  projectRoot: string,
  recursive: boolean,
  includeHidden: boolean,
  currentDepth: number,
  maxDepth: number,
  budget: TraversalBudget,
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

    if (budget.remaining > 0) {
      budget.remaining -= 1;
      const fileInfo: FileInfo = {
        name: item,
        path: relative(projectRoot, itemPath),
        type: itemStat.isDirectory() ? 'directory' : 'file',
      };

      if (itemStat.isFile()) {
        fileInfo.size = itemStat.size;
        fileInfo.modifiedAt = itemStat.mtime.toISOString();
      }

      entries.push(fileInfo);
    } else {
      budget.omitted += 1;
    }

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
        maxDepth,
        budget,
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
        description: '相对于项目根目录的目录路径',
      },
      recursive: {
        type: 'boolean',
        description: '是否递归列出子目录，默认 false',
        default: false,
      },
      includeHidden: {
        type: 'boolean',
        description: '是否包含隐藏文件（以 . 开头），默认 false',
        default: false,
      },
      maxDepth: {
        type: 'number',
        description: '递归时的最大深度，默认 3，必须是正整数，上限 10',
        default: 3,
      },
      maxEntries: {
        type: 'number',
        description:
          '返回条目数预算，默认 2000，必须是正整数，上限 2000；超出时 truncated 为 true 并返回 omittedEntries',
        default: 2000,
      },
    },
    required: ['path'],
  },
};
