/**
 * MCP Tool definitions for Filesense
 * Exposes filesense operations as MCP-compatible tools for FrontAgent
 */

import { resolve } from 'node:path';
import * as engine from './engine.js';
import type {
  CheckSummary,
  NavigateResult,
  QueryResult,
  SummarizeSummary,
  SyncSummary,
} from './types.js';

// ─── Tool Schemas ──────────────────────────────────────────────────────────────

export const filesenseInitSchema = {
  name: 'filesense_init',
  description:
    '初始化 Filesense 目录索引。在项目根目录创建 .filesrc.json 配置、.filesignore 忽略规则、JSON Schema 文件，并执行首次索引同步。适用于首次在项目中启用 Filesense 时调用。',
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
  description:
    '同步目录索引。递归扫描目录树，更新每个目录的 FILES.json 索引文件。仅在文件发生变化时重新计算哈希，增量更新高效。用于在文件操作后保持索引最新。',
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
      depth: {
        type: 'number',
        description: '最大递归深度。用于限制大仓库扫描范围。',
      },
      maxEntries: {
        type: 'number',
        description: '最多扫描目录数量，超出后截断。',
      },
      timeoutMs: {
        type: 'number',
        description: '最大扫描耗时毫秒，超出后截断。',
      },
    },
    required: [] as string[],
  },
};

export const filesenseSummarizeSchema = {
  name: 'filesense_summarize',
  description:
    '为目录生成语义摘要。基于目录内容推断目录用途、Agent 提示、编码约定和关键入口点，写入 FILES.notes.json。帮助 Agent 快速理解目录结构和导航策略。',
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
  description:
    '查询目录的索引和语义摘要。返回 FILES.json 中的文件列表（含哈希、大小、类型）和 FILES.notes.json 中的目录用途、Agent 提示等信息。用于快速了解目录内容而无需逐个读取文件。',
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
  description:
    '检查索引覆盖率和新鲜度。报告缺失索引、过期索引、无效索引等问题。用于验证 Filesense 索引是否完整且最新。',
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
  description:
    '持久化生成/刷新 Filesense 索引和语义摘要（sync + summarize）。这是较重的维护操作；普通规划、定位、结构理解应优先使用只读轻量的 filesense_navigate。',
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

export const filesenseNavigateSchema = {
  name: 'filesense_navigate',
  description:
    '首选的 Agent 目录导航工具：按需、只读/预算化扫描当前仓库，返回 summary、candidates、factsDelta、warnings 和 scanned 元信息。用于结构理解、入口定位、创建/重构前探路；避免为普通导航触发全仓 sync_and_summarize。',
  inputSchema: {
    type: 'object' as const,
    properties: {
      paths: {
        type: 'array',
        items: { type: 'string' },
        description: '要扫描的相对路径列表，默认项目根目录',
      },
      intent: {
        type: 'string',
        enum: [
          'locate',
          'understand_structure',
          'find_conventions',
          'prepare_refactor',
          'prepare_create',
          'validate_freshness',
        ],
        description: '导航意图，用于候选路径排序和摘要聚焦',
      },
      depth: { type: 'number', description: '最大递归深度，默认 2' },
      maxEntries: { type: 'number', description: '最大条目预算，默认 300' },
      maxBytes: { type: 'number', description: '返回结果最大字节预算，默认不强制' },
      timeoutMs: { type: 'number', description: '最大扫描耗时毫秒，默认 3000' },
      output: {
        type: 'string',
        enum: ['summary', 'candidates', 'verbose'],
        description: '输出详细程度，默认 summary',
      },
      writeMode: {
        type: 'string',
        enum: ['cache', 'workspace', 'none'],
        description: '写入模式。当前 navigate 默认 none/cache 语义，不写业务目录。',
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
  filesenseNavigateSchema,
];

// ─── Tool Handlers ─────────────────────────────────────────────────────────────

export interface FilesenseToolResult {
  success: boolean;
  data?:
    | SyncSummary
    | SummarizeSummary
    | CheckSummary
    | QueryResult
    | NavigateResult
    | { sync: SyncSummary; summarize: SummarizeSummary };
  error?: string;
}

function resolvePath(inputPath: string | undefined, projectRoot: string): string {
  if (!inputPath || inputPath === '.' || inputPath === '') return projectRoot;
  return resolve(projectRoot, inputPath);
}

export async function handleFilesenseTool(
  toolName: string,
  args: Record<string, unknown>,
  projectRoot: string,
): Promise<FilesenseToolResult> {
  try {
    const targetPath = resolvePath(args.path as string | undefined, projectRoot);

    switch (toolName) {
      case 'filesense_init': {
        const result = await engine.init(targetPath);
        return { success: true, data: result };
      }
      case 'filesense_sync': {
        const result = await engine.syncIndexes(targetPath, (args.full as boolean) ?? false, {
          depth: args.depth as number | undefined,
          maxEntries: args.maxEntries as number | undefined,
          timeoutMs: args.timeoutMs as number | undefined,
        });
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
      case 'filesense_navigate': {
        const firstPath =
          Array.isArray(args.paths) && typeof args.paths[0] === 'string'
            ? resolvePath(args.paths[0], projectRoot)
            : targetPath;
        const result = await engine.navigate(firstPath, {
          paths: Array.isArray(args.paths)
            ? args.paths.filter((item): item is string => typeof item === 'string')
            : undefined,
          intent: args.intent as never,
          depth: args.depth as number | undefined,
          maxEntries: args.maxEntries as number | undefined,
          maxBytes: args.maxBytes as number | undefined,
          timeoutMs: args.timeoutMs as number | undefined,
          output: args.output as never,
          writeMode: args.writeMode as never,
        });
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
