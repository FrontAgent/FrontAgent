/**
 * Shell MCP Client
 * 提供终端命令执行功能
 */

import { spawn } from 'node:child_process';
import { isAbsolute, relative, resolve } from 'node:path';
import { analyzeShellCommand, detectDangerousShellCommand } from '@frontagent/shared';

export interface RunCommandParams {
  command: string;
  workingDirectory?: string;
  timeout?: number;
  requiresApproval?: boolean;
  __frontagentSecurityApproved?: boolean;
}

export interface RunCommandResult {
  success: boolean;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  error?: string;
}

export interface ShellMCPClientOptions {
  streamOutput?: boolean;
}

/**
 * Shell MCP Client
 */
export class ShellMCPClient {
  private projectRoot: string;
  private approvalCallback?: (command: string) => Promise<boolean>;
  private streamOutput: boolean;

  constructor(
    projectRoot: string,
    approvalCallback?: (command: string) => Promise<boolean>,
    options: ShellMCPClientOptions = {},
  ) {
    this.projectRoot = projectRoot;
    this.approvalCallback = approvalCallback;
    this.streamOutput = options.streamOutput ?? true;
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
              description: '要执行的命令',
            },
            workingDirectory: {
              type: 'string',
              description: '工作目录（可选，默认为项目根目录）',
            },
            timeout: {
              type: 'number',
              description: '超时时间（毫秒，默认 60000）',
            },
          },
          required: ['command'],
        },
      },
    ];
  }

  /**
   * 执行命令（使用 spawn 支持长时间运行的命令）
   */
  private async runCommand(params: RunCommandParams): Promise<RunCommandResult> {
    const {
      command,
      workingDirectory,
      timeout = 60_000,
      __frontagentSecurityApproved = false,
    } = params;
    const analysis = analyzeShellCommand(command);
    const dangerous = detectDangerousShellCommand(command, analysis);

    if (dangerous.dangerous) {
      return {
        success: false,
        error: dangerous.reason ?? 'Dangerous command blocked by shell hard boundary',
      };
    }

    // 如果需要批准，先请求用户批准
    if (this.approvalCallback) {
      const approved = await this.approvalCallback(command);
      if (!approved) {
        return {
          success: false,
          error: 'Command execution was rejected by user',
        };
      }
    } else if (!analysis.structurallyTrusted && !__frontagentSecurityApproved) {
      return {
        success: false,
        error: `Command requires security approval before shell execution: ${analysis.reason ?? 'complex shell structure'}`,
      };
    }

    const cwd = resolve(this.projectRoot, workingDirectory ?? '.');
    const root = resolve(this.projectRoot);
    const relativeCwd = relative(root, cwd);
    if (relativeCwd.startsWith('..') || isAbsolute(relativeCwd)) {
      return {
        success: false,
        error: 'Access denied: workingDirectory is outside project root',
      };
    }

    const MAX_OUTPUT_BYTES = 10 * 1024 * 1024; // 10MB

    return new Promise((resolvePromise) => {
      const child = analysis.structurallyTrusted
        ? spawn(analysis.argv[0], analysis.argv.slice(1), {
            cwd,
            shell: false,
            stdio: ['ignore', 'pipe', 'pipe'],
          })
        : spawn(command, {
            cwd,
            shell: true,
            stdio: ['ignore', 'pipe', 'pipe'],
          });

      let killed = false;
      let totalBytes = 0;
      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];

      const timer = setTimeout(() => {
        killed = true;
        child.kill('SIGTERM');
        setTimeout(() => {
          if (!child.killed) child.kill('SIGKILL');
        }, 2000);
      }, timeout);

      const killForOutputOverflow = () => {
        if (!killed) {
          killed = true;
          child.kill('SIGTERM');
        }
      };

      child.stdout?.on('data', (chunk: Buffer) => {
        totalBytes += chunk.length;
        if (totalBytes > MAX_OUTPUT_BYTES) {
          killForOutputOverflow();
          return;
        }
        stdoutChunks.push(chunk);
        if (this.streamOutput) {
          process.stdout.write(chunk);
        }
      });

      child.stderr?.on('data', (chunk: Buffer) => {
        totalBytes += chunk.length;
        if (totalBytes > MAX_OUTPUT_BYTES) {
          killForOutputOverflow();
          return;
        }
        stderrChunks.push(chunk);
        if (this.streamOutput) {
          process.stderr.write(chunk);
        }
      });

      child.on('error', (error) => {
        clearTimeout(timer);
        resolvePromise({
          success: false,
          stdout: Buffer.concat(stdoutChunks).toString(),
          stderr: Buffer.concat(stderrChunks).toString(),
          exitCode: 1,
          error: `Command execution error: ${error.message}`,
        });
      });

      child.on('close', (exitCode) => {
        clearTimeout(timer);
        const stdout = Buffer.concat(stdoutChunks).toString();
        const stderr = Buffer.concat(stderrChunks).toString();

        if (killed && totalBytes > MAX_OUTPUT_BYTES) {
          resolvePromise({
            success: false,
            stdout,
            stderr,
            exitCode: 1,
            error: `Command killed: output exceeded ${MAX_OUTPUT_BYTES} bytes limit`,
          });
          return;
        }

        if (killed) {
          resolvePromise({
            success: false,
            stdout,
            stderr,
            exitCode: 1,
            error: `Command timed out after ${timeout}ms: ${command}`,
          });
          return;
        }

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

        resolvePromise({
          success,
          stdout,
          stderr,
          exitCode: code,
          error: errorMessage,
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
  approvalCallback?: (command: string) => Promise<boolean>,
  options?: ShellMCPClientOptions,
): ShellMCPClient {
  return new ShellMCPClient(projectRoot, approvalCallback, options);
}
