/**
 * Shell MCP Client
 * 提供终端命令执行功能
 */

import { spawn } from 'node:child_process';

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
   * 执行命令（使用 spawn 支持长时间运行的命令）
   */
  private async runCommand(params: RunCommandParams): Promise<RunCommandResult> {
    const { command, workingDirectory } = params;

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

    return new Promise((resolve) => {
      // 使用 shell 模式执行命令，支持管道、重定向等
      const child = spawn(command, {
        cwd,
        shell: true,
        stdio: ['inherit', 'pipe', 'pipe']
      });

      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];

      child.stdout?.on('data', (chunk: Buffer) => {
        stdoutChunks.push(chunk);
        // 实时输出到控制台
        process.stdout.write(chunk);
      });

      child.stderr?.on('data', (chunk: Buffer) => {
        stderrChunks.push(chunk);
        // 实时输出到控制台
        process.stderr.write(chunk);
      });

      child.on('error', (error) => {
        resolve({
          success: false,
          stdout: Buffer.concat(stdoutChunks).toString(),
          stderr: Buffer.concat(stderrChunks).toString(),
          exitCode: 1,
          error: `Command execution error: ${error.message}`
        });
      });

      child.on('close', (exitCode) => {
        const stdout = Buffer.concat(stdoutChunks).toString();
        const stderr = Buffer.concat(stderrChunks).toString();
        const code = exitCode ?? 0;
        const success = code === 0;

        let errorMessage: string | undefined;
        if (!success) {
          const parts: string[] = [`Command failed with exit code ${code}: ${command}`];
          if (stderr.trim()) {
            parts.push(`stderr: ${stderr.trim()}`);
          }
          errorMessage = parts.join('\n');
        }

        resolve({
          success,
          stdout,
          stderr,
          exitCode: code,
          error: errorMessage
        });
      });
    });
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
