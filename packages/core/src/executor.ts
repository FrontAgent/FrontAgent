/**
 * Agent Executor
 * 负责执行计划中的步骤
 */

import type { ExecutionStep, StepResult, ValidationResult } from '@frontagent/shared';
import { HallucinationGuard } from '@frontagent/hallucination-guard';
import type { ExecutorOutput } from './types.js';

/**
 * MCP 客户端接口
 */
export interface MCPClient {
  callTool(name: string, args: Record<string, unknown>): Promise<unknown>;
  listTools(): Promise<Array<{ name: string; description: string }>>;
}

/**
 * Executor 配置
 */
export interface ExecutorConfig {
  /** 幻觉防控器 */
  hallucinationGuard: HallucinationGuard;
  /** 调试模式 */
  debug?: boolean;
}

/**
 * Executor 类
 */
export class Executor {
  private config: ExecutorConfig;
  private mcpClients: Map<string, MCPClient> = new Map();
  private toolToClient: Map<string, string> = new Map();

  constructor(config: ExecutorConfig) {
    this.config = config;
  }

  /**
   * 注册 MCP 客户端
   */
  registerMCPClient(name: string, client: MCPClient): void {
    this.mcpClients.set(name, client);
  }

  /**
   * 注册工具到客户端的映射
   */
  registerToolMapping(toolName: string, clientName: string): void {
    this.toolToClient.set(toolName, clientName);
  }

  /**
   * 执行单个步骤
   */
  async executeStep(step: ExecutionStep): Promise<ExecutorOutput> {
    const startTime = Date.now();

    try {
      // 1. 执行前验证
      const preValidation = await this.validateBeforeExecution(step);
      if (!preValidation.pass) {
        return {
          stepResult: {
            success: false,
            error: `Pre-execution validation failed: ${preValidation.blockedBy?.join('; ')}`,
            duration: Date.now() - startTime
          },
          validation: preValidation,
          needsRollback: false
        };
      }

      // 2. 调用 MCP 工具
      const toolResult = await this.callTool(step.tool, step.params);

      // 3. 执行后验证
      const postValidation = await this.validateAfterExecution(step, toolResult);

      // 4. 构建结果
      const stepResult: StepResult = {
        success: postValidation.pass,
        output: toolResult,
        error: postValidation.pass ? undefined : postValidation.blockedBy?.join('; '),
        duration: Date.now() - startTime,
        snapshotId: (toolResult as { snapshotId?: string })?.snapshotId
      };

      return {
        stepResult,
        validation: postValidation,
        needsRollback: !postValidation.pass && step.validation.some(v => v.required)
      };
    } catch (error) {
      return {
        stepResult: {
          success: false,
          error: error instanceof Error ? error.message : String(error),
          duration: Date.now() - startTime
        },
        validation: {
          pass: false,
          results: [],
          blockedBy: [error instanceof Error ? error.message : String(error)]
        },
        needsRollback: true
      };
    }
  }

  /**
   * 执行前验证
   */
  private async validateBeforeExecution(step: ExecutionStep): Promise<ValidationResult> {
    const results: ValidationResult['results'] = [];

    // 对于读取文件操作，验证文件存在
    if (step.action === 'read_file' && step.params.path) {
      const fileCheck = await this.config.hallucinationGuard.validateFilePath(
        step.params.path as string,
        true
      );
      results.push(fileCheck);
    }

    // 对于创建文件操作，验证文件不存在
    if (step.action === 'create_file' && step.params.path && !step.params.overwrite) {
      const fileCheck = await this.config.hallucinationGuard.validateFilePath(
        step.params.path as string,
        false
      );
      results.push(fileCheck);
    }

    const blockedBy = results
      .filter(r => !r.pass && r.severity === 'block')
      .map(r => r.message ?? r.type);

    return {
      pass: blockedBy.length === 0,
      results,
      blockedBy: blockedBy.length > 0 ? blockedBy : undefined
    };
  }

  /**
   * 执行后验证
   */
  private async validateAfterExecution(
    step: ExecutionStep,
    result: unknown
  ): Promise<ValidationResult> {
    // 检查工具调用是否成功
    if (typeof result === 'object' && result !== null) {
      const resultObj = result as { success?: boolean; error?: string };
      if (resultObj.success === false) {
        return {
          pass: false,
          results: [],
          blockedBy: [resultObj.error ?? 'Tool execution failed']
        };
      }
    }

    // 对于代码修改操作，进行额外验证
    if (['apply_patch', 'create_file'].includes(step.action)) {
      const content = (result as { content?: string })?.content ?? 
                     step.params.content as string | undefined;
      const path = step.params.path as string;

      if (content && path) {
        const language = this.detectLanguage(path);
        if (language) {
          const codeValidation = await this.config.hallucinationGuard.validateCode(
            content,
            language,
            path
          );
          return codeValidation;
        }
      }
    }

    return {
      pass: true,
      results: []
    };
  }

  /**
   * 调用 MCP 工具
   */
  private async callTool(toolName: string, args: Record<string, unknown>): Promise<unknown> {
    const clientName = this.toolToClient.get(toolName);
    if (!clientName) {
      throw new Error(`No MCP client registered for tool: ${toolName}`);
    }

    const client = this.mcpClients.get(clientName);
    if (!client) {
      throw new Error(`MCP client not found: ${clientName}`);
    }

    if (this.config.debug) {
      console.log(`[Executor] Calling tool: ${toolName}`, args);
    }

    const result = await client.callTool(toolName, args);

    if (this.config.debug) {
      console.log(`[Executor] Tool result:`, result);
    }

    return result;
  }

  /**
   * 批量执行步骤
   */
  async executeSteps(
    steps: ExecutionStep[],
    onStepComplete?: (step: ExecutionStep, output: ExecutorOutput) => void
  ): Promise<ExecutorOutput[]> {
    const results: ExecutorOutput[] = [];
    const completedSteps = new Set<string>();

    // 按依赖顺序执行
    const pendingSteps = [...steps];
    
    while (pendingSteps.length > 0) {
      // 找到可以执行的步骤（依赖已完成）
      const executableIndex = pendingSteps.findIndex(step =>
        step.dependencies.every(dep => completedSteps.has(dep))
      );

      if (executableIndex === -1) {
        // 没有可执行的步骤，可能有循环依赖
        throw new Error('Circular dependency detected or missing dependency');
      }

      const step = pendingSteps.splice(executableIndex, 1)[0];
      step.status = 'running';

      const output = await this.executeStep(step);
      step.result = output.stepResult;
      step.status = output.stepResult.success ? 'completed' : 'failed';

      results.push(output);
      completedSteps.add(step.stepId);

      if (onStepComplete) {
        onStepComplete(step, output);
      }

      // 如果步骤失败且需要回滚，停止执行
      if (!output.stepResult.success && output.needsRollback) {
        // 标记剩余步骤为跳过
        for (const pending of pendingSteps) {
          pending.status = 'skipped';
        }
        break;
      }
    }

    return results;
  }

  /**
   * 回滚操作
   */
  async rollback(snapshotId: string): Promise<{ success: boolean; message: string }> {
    try {
      const result = await this.callTool('rollback', { snapshotId });
      return result as { success: boolean; message: string };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 检测文件语言
   */
  private detectLanguage(path: string): 'typescript' | 'javascript' | 'json' | 'yaml' | null {
    const ext = path.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'ts':
      case 'tsx':
        return 'typescript';
      case 'js':
      case 'jsx':
      case 'mjs':
      case 'cjs':
        return 'javascript';
      case 'json':
        return 'json';
      case 'yaml':
      case 'yml':
        return 'yaml';
      default:
        return null;
    }
  }
}

/**
 * 创建 Executor 实例
 */
export function createExecutor(config: ExecutorConfig): Executor {
  return new Executor(config);
}

