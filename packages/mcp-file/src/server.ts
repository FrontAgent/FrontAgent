#!/usr/bin/env node
/**
 * MCP File Server
 * 提供文件操作的 MCP 工具接口
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { SnapshotManager } from './snapshot.js';
import { readFile, readFileSchema } from './tools/read-file.js';
import { applyPatch, applyPatchSchema } from './tools/apply-patch.js';
import { createFile, createFileSchema } from './tools/create-file.js';
import { searchCode, searchCodeSchema } from './tools/search-code.js';
import { listDirectory, listDirectorySchema } from './tools/list-directory.js';
import { getAST, getASTSchema } from './tools/get-ast.js';

// 从环境变量或参数获取项目根目录
const projectRoot = process.env.PROJECT_ROOT ?? process.cwd();

// 初始化快照管理器
const snapshotManager = new SnapshotManager(projectRoot);
snapshotManager.loadSnapshots();

// 创建 MCP Server
const server = new Server(
  {
    name: 'frontagent-file-server',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// 注册工具列表
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      readFileSchema,
      applyPatchSchema,
      createFileSchema,
      searchCodeSchema,
      listDirectorySchema,
      getASTSchema,
      {
        name: 'rollback',
        description: '回滚到指定快照',
        inputSchema: {
          type: 'object' as const,
          properties: {
            snapshotId: {
              type: 'string',
              description: '快照 ID'
            }
          },
          required: ['snapshotId']
        }
      },
      {
        name: 'get_snapshots',
        description: '获取指定文件的所有快照',
        inputSchema: {
          type: 'object' as const,
          properties: {
            path: {
              type: 'string',
              description: '文件路径'
            }
          },
          required: ['path']
        }
      }
    ],
  };
});

// 处理工具调用
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'read_file': {
        const result = readFile(args as unknown as Parameters<typeof readFile>[0], projectRoot);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'apply_patch': {
        const result = applyPatch(
          args as unknown as Parameters<typeof applyPatch>[0],
          projectRoot,
          snapshotManager
        );
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'create_file': {
        const result = createFile(
          args as unknown as Parameters<typeof createFile>[0],
          projectRoot,
          snapshotManager
        );
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'search_code': {
        const result = await searchCode(
          args as unknown as Parameters<typeof searchCode>[0],
          projectRoot
        );
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'list_directory': {
        const result = listDirectory(
          args as unknown as Parameters<typeof listDirectory>[0],
          projectRoot
        );
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'get_ast': {
        const result = getAST(args as unknown as Parameters<typeof getAST>[0], projectRoot);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'rollback': {
        const { snapshotId } = args as { snapshotId: string };
        const result = snapshotManager.rollback(snapshotId);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'get_snapshots': {
        const { path } = args as { path: string };
        const snapshots = snapshotManager.getFileSnapshots(path);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  snapshots: snapshots.map((s) => ({
                    id: s.id,
                    timestamp: new Date(s.timestamp).toISOString(),
                    operation: s.operation,
                  })),
                },
                null,
                2
              ),
            },
          ],
        };
      }

      default:
        return {
          content: [{ type: 'text', text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error executing ${name}: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

// 启动服务器
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`MCP File Server started (project root: ${projectRoot})`);
}

main().catch(console.error);

