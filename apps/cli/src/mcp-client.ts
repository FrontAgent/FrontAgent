/**
 * MCP 客户端包装器
 * 用于直接调用 MCP 工具函数
 */

import type { MCPClient } from '@frontagent/core';
import {
  readFile,
  applyPatch,
  createFile,
  searchCode,
  listDirectory,
  getAST,
  SnapshotManager,
} from '@frontagent/mcp-file';

/**
 * 文件操作 MCP 客户端
 */
export class FileMCPClient implements MCPClient {
  private projectRoot: string;
  private snapshotManager: SnapshotManager;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.snapshotManager = new SnapshotManager(projectRoot);
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    switch (name) {
      case 'read_file':
        return readFile(args as any, this.projectRoot);

      case 'apply_patch':
        return applyPatch(args as any, this.projectRoot, this.snapshotManager);

      case 'create_file':
        return createFile(args as any, this.projectRoot, this.snapshotManager);

      case 'search_code':
        return searchCode(args as any, this.projectRoot);

      case 'list_directory':
        return listDirectory(args as any, this.projectRoot);

      case 'get_ast':
        return getAST(args as any, this.projectRoot);

      case 'rollback':
        return this.snapshotManager.rollback((args as any).snapshotId);

      case 'get_snapshots': {
        const filePath = (args as any).filePath;
        if (filePath) {
          return { snapshots: this.snapshotManager.getFileSnapshots(filePath) };
        }
        return { snapshots: [] };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  async listTools() {
    return [
      { name: 'read_file', description: '读取文件内容' },
      { name: 'apply_patch', description: '应用代码补丁' },
      { name: 'create_file', description: '创建新文件' },
      { name: 'search_code', description: '搜索代码' },
      { name: 'list_directory', description: '列出目录' },
      { name: 'get_ast', description: '获取 AST 分析' },
      { name: 'rollback', description: '回滚修改' },
      { name: 'get_snapshots', description: '获取快照列表' },
    ];
  }
}

/**
 * Web 操作 MCP 客户端（暂时为空实现）
 */
export class WebMCPClient implements MCPClient {
  async callTool(_name: string, _args: Record<string, unknown>): Promise<unknown> {
    throw new Error('Web MCP client not yet implemented');
  }

  async listTools() {
    return [];
  }
}
