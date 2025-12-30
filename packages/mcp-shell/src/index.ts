/**
 * Shell MCP Client
 * 提供终端命令执行功能
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

export interface RunCommandParams {
  command: string;
  workingDirectory?: string;
  timeout?: number;
  requiresApproval?: boolean;
}

export interface RunCommandResult {
  success: boolean;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  error?: string;
}

/**
 * Shell MCP Client
 */
export class ShellMCPClient {
  private projectRoot: string;
  private approvalCallback?: (command: string) => Promise<boolean>;

  constructor(
    projectRoot: string,
    approvalCallback?: (command: string) => Promise<boolean>
  ) {
    this.projectRoot = projectRoot;
    this.approvalCallback = approvalCallback;
  }

  /**
   * 设置命令批准回调
   */
  setApprovalCallback(callback: (command: string) => Promise<boolean>): void {
    this.approvalCallback = callback;
  }

  /**
   * 调用工具
   */
  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    switch (name) {
      case 'run_command':
        return this.runCommand(args as unknown as RunCommandParams);
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  /**
   * 列出可用工具
   */
  async listTools() {
    return [
      {
        name: 'run_command',
        description: '执行终端命令（需要用户批准）',
        inputSchema: {
          type: 'object' as const,
          properties: {
            command: {
              type: 'string',
              description: '要执行的命令'
            },
            workingDirectory: {
              type: 'string',
              description: '工作目录（可选，默认为项目根目录）'
            },
            timeout: {
              type: 'number',
              description: '超时时间（毫秒，默认 60000）'
            }
          },
          required: ['command']
        }
      }
    ];
  }

  /**
   * 执行命令
   */
  private async runCommand(params: RunCommandParams): Promise<RunCommandResult> {
    const { command, workingDirectory, timeout = 60000 } = params;

    // 如果需要批准，先请求用户批准
    if (this.approvalCallback) {
      const approved = await this.approvalCallback(command);
      if (!approved) {
        return {
          success: false,
          error: 'Command execution was rejected by user'
        };
      }
    }

    const cwd = workingDirectory || this.projectRoot;

    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd,
        timeout,
        maxBuffer: 1024 * 1024 * 10 // 10MB
      });

      // 命令执行成功（exitCode = 0）
      // 注意：stderr 可能包含警告信息，但这不代表失败
      return {
        success: true,
        stdout,
        stderr,
        exitCode: 0
      };
    } catch (error: any) {
      // 只有当命令真正失败（非0退出码）时才标记为失败
      // 有些命令会在 stderr 输出警告但仍然成功（exitCode = 0）
      const exitCode = error.code || error.exitCode || 1;
      const isActualFailure = exitCode !== 0;

      // 构建详细的错误信息，包含 stderr 和 stdout
      let errorMessage: string | undefined;
      if (isActualFailure) {
        const parts: string[] = [`Command failed: ${command}`];
        if (error.stderr) {
          parts.push(`stderr: ${error.stderr.trim()}`);
        }
        if (error.stdout) {
          parts.push(`stdout: ${error.stdout.trim()}`);
        }
        errorMessage = parts.join('\n');
      }

      return {
        success: !isActualFailure,
        stdout: error.stdout || '',
        stderr: error.stderr || '',
        exitCode,
        error: errorMessage
      };
    }
  }
}

/**
 * 创建 Shell MCP Client
 */
export function createShellMCPClient(
  projectRoot: string,
  approvalCallback?: (command: string) => Promise<boolean>
): ShellMCPClient {
  return new ShellMCPClient(projectRoot, approvalCallback);
}
