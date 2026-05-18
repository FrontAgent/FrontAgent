/**
 * MCP Tool definitions for Filesense
 * Exposes filesense operations as MCP-compatible tools for FrontAgent
 */

import { resolve } from 'node:path';
import * as engine from './engine.js';
import type { SyncSummary, SummarizeSummary, CheckSummary, QueryResult } from './types.js';

// ─── Tool Schemas ──────────────────────────────────────────────────────────────

export const filesenseInitSchema = {
  name: 'filesense_init',
  description: '初始化 Filesense 目录索引。在项目根目录创建 .filesrc.json 配置、.filesignore 忽略规则、JSON Schema 文件，并执行首次索引同步。适用于首次在项目中启用 Filesense 时调用。',
  inputSchema: {
    type: 'object' as const,
    properties: {
      path: {
        type: 'string',
        description: '要初始化的目录路径（相对于项目根目录），默认为项目根目录',
      },
    },
    required: [] as string[],
  },
};

export const filesenseSyncSchema = {
  name: 'filesense_sync',
  description: '同步目录索引。递归扫描目录树，更新每个目录的 FILES.json 索引文件。仅在文件发生变化时重新计算哈希，增量更新高效。用于在文件操作后保持索引最新。',
  inputSchema: {
    type: 'object' as const,
    properties: {
      path: {
        type: 'string',
        description: '要同步的目录路径（相对于项目根目录），默认为项目根目录',
      },
      full: {
        type: 'boolean',
        description: '是否强制全量重新计算所有文件哈希（忽略 mtime/size 缓存），默认 false',
        default: false,
      },
    },
    required: [] as string[],
  },
};

export const filesenseSummarizeSchema = {
  name: 'filesense_summarize',
  description: '为目录生成语义摘要。基于目录内容推断目录用途、Agent 提示、编码约定和关键入口点，写入 FILES.notes.json。帮助 Agent 快速理解目录结构和导航策略。',
  inputSchema: {
    type: 'object' as const,
    properties: {
      path: {
        type: 'string',
        description: '要生成摘要的目录路径（相对于项目根目录），默认为项目根目录',
      },
      force: {
        type: 'boolean',
        description: '是否覆盖已有的人工编写的 notes 字段，默认 false（保留人工编写内容）',
        default: false,
      },
    },
    required: [] as string[],
  },
};

export const filesenseQuerySchema = {
  name: 'filesense_query',
  description: '查询目录的索引和语义摘要。返回 FILES.json 中的文件列表（含哈希、大小、类型）和 FILES.notes.json 中的目录用途、Agent 提示等信息。用于快速了解目录内容而无需逐个读取文件。',
  inputSchema: {
    type: 'object' as const,
    properties: {
      path: {
        type: 'string',
        description: '要查询的目录路径（相对于项目根目录）',
      },
    },
    required: ['path'],
  },
};

export const filesenseCheckSchema = {
  name: 'filesense_check',
  description: '检查索引覆盖率和新鲜度。报告缺失索引、过期索引、无效索引等问题。用于验证 Filesense 索引是否完整且最新。',
  inputSchema: {
    type: 'object' as const,
    properties: {
      path: {
        type: 'string',
        description: '要检查的目录路径（相对于项目根目录），默认为项目根目录',
      },
    },
    required: [] as string[],
  },
};

export const filesenseSyncAndSummarizeSchema = {
  name: 'filesense_sync_and_summarize',
  description: '一次性完成索引同步和语义摘要生成。等价于依次调用 filesense_sync + filesense_summarize，是最常用的操作。在项目文件变更后调用此工具可同时更新索引和摘要。',
  inputSchema: {
    type: 'object' as const,
    properties: {
      path: {
        type: 'string',
        description: '要处理的目录路径（相对于项目根目录），默认为项目根目录',
      },
      full: {
        type: 'boolean',
        description: '是否强制全量重新计算哈希，默认 false',
        default: false,
      },
    },
    required: [] as string[],
  },
};

// ─── All schemas for registration ─────────────────────────────────────────────

export const allFilesenseSchemas = [
  filesenseInitSchema,
  filesenseSyncSchema,
  filesenseSummarizeSchema,
  filesenseQuerySchema,
  filesenseCheckSchema,
  filesenseSyncAndSummarizeSchema,
];

// ─── Tool Handlers ─────────────────────────────────────────────────────────────

export interface FilesenseToolResult {
  success: boolean;
  data?: SyncSummary | SummarizeSummary | CheckSummary | QueryResult | { sync: SyncSummary; summarize: SummarizeSummary };
  error?: string;
}

function resolvePath(inputPath: string | undefined, projectRoot: string): string {
  if (!inputPath || inputPath === '.' || inputPath === '') return projectRoot;
  return resolve(projectRoot, inputPath);
}

export async function handleFilesenseTool(
  toolName: string,
  args: Record<string, unknown>,
  projectRoot: string
): Promise<FilesenseToolResult> {
  try {
    const targetPath = resolvePath(args.path as string | undefined, projectRoot);

    switch (toolName) {
      case 'filesense_init': {
        const result = await engine.init(targetPath);
        return { success: true, data: result };
      }
      case 'filesense_sync': {
        const result = await engine.syncIndexes(targetPath, (args.full as boolean) ?? false);
        return { success: true, data: result };
      }
      case 'filesense_summarize': {
        const result = await engine.summarize(targetPath, (args.force as boolean) ?? false);
        return { success: true, data: result };
      }
      case 'filesense_query': {
        const result = await engine.query(targetPath);
        return { success: true, data: result };
      }
      case 'filesense_check': {
        const result = await engine.check(targetPath);
        return { success: true, data: result };
      }
      case 'filesense_sync_and_summarize': {
        const result = await engine.syncAndSummarize(targetPath, (args.full as boolean) ?? false);
        return { success: true, data: result };
      }
      default:
        return { success: false, error: `Unknown filesense tool: ${toolName}` };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
