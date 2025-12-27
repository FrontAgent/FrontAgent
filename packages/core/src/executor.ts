/**
 * Agent Executor（两阶段架构 - Stage 2）
 * 负责执行计划中的步骤，并在需要时动态生成代码
 */

import type { ExecutionStep, StepResult, ValidationResult, AgentTask } from '@frontagent/shared';
import { HallucinationGuard } from '@frontagent/hallucination-guard';
import type { ExecutorOutput } from './types.js';
import { LLMService } from './llm.js';

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
  /** LLM 服务（用于动态代码生成） */
  llmService: LLMService;
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
   * 执行单个步骤（Stage 2: 支持动态代码生成）
   */
  async executeStep(
    step: ExecutionStep,
    context: {
      task: AgentTask;
      collectedContext: { files: Map<string, string> };
      sddConstraints?: string;
    }
  ): Promise<ExecutorOutput> {
    const startTime = Date.now();

    try {
      // 1. 执行前验证
      const preValidation = await this.validateBeforeExecution(step);
      if (!preValidation.pass) {
        // 检查是否是"尝试读取目录"这类可以跳过的错误
        const errorMsg = preValidation.blockedBy?.join('; ') || '';
        const isSkippableError = errorMsg.includes('is not a file') || errorMsg.includes('Not a file');

        if (isSkippableError) {
          // 跳过这个步骤而不是失败
          if (this.config.debug) {
            console.log(`[Executor] Skipping step due to validation: ${errorMsg}`);
          }
          return {
            stepResult: {
              success: true, // 标记为成功，这样不会阻塞后续步骤
              output: { skipped: true, reason: errorMsg },
              duration: Date.now() - startTime
            },
            validation: { pass: true, results: [] },
            needsRollback: false
          };
        }

        // 其他验证失败仍然返回错误
        return {
          stepResult: {
            success: false,
            error: `Pre-execution validation failed: ${errorMsg}`,
            duration: Date.now() - startTime
          },
          validation: preValidation,
          needsRollback: false
        };
      }

      // 2. 动态代码生成（如果需要）
      let toolParams = { ...step.params };
      const stepAny = step as any;

      if (this.config.debug) {
        console.log(`[Executor] Step action: ${step.action}, needsCodeGeneration: ${stepAny.needsCodeGeneration}`);
        console.log(`[Executor] Step params:`, toolParams);
      }

      // 检查是否需要代码生成：
      // 1. 明确设置了 needsCodeGeneration: true
      // 2. 或者是 create_file/apply_patch 操作但没有提供 content
      const shouldGenerateCode =
        stepAny.needsCodeGeneration ||
        ((step.action === 'create_file' || step.action === 'apply_patch') && !toolParams.content);

      if (shouldGenerateCode && (step.action === 'create_file' || step.action === 'apply_patch')) {
        const filePath = toolParams.path as string;
        const language = this.detectLanguage(filePath);

        if (step.action === 'create_file') {
          // 生成新文件代码
          const codeDescription = (toolParams.codeDescription as string) || step.description;
          const contextStr = this.buildContextString(context.collectedContext);

          if (this.config.debug) {
            console.log(`[Executor] Generating code for new file: ${filePath}`);
            console.log(`[Executor] Code description: ${codeDescription}`);
          }

          const code = await this.config.llmService.generateCodeForFile({
            task: context.task.description,
            filePath,
            codeDescription,
            context: contextStr,
            language: language || 'typescript',
            sddConstraints: context.sddConstraints,
          });

          if (this.config.debug) {
            console.log(`[Executor] Generated code length: ${code.length} characters`);
          }

          // 将生成的代码添加到参数中
          toolParams = {
            ...toolParams,
            content: code,
          };

        } else if (step.action === 'apply_patch') {
          // 修改现有文件
          const changeDescription = (toolParams.changeDescription as string) || step.description;
          const originalCode = context.collectedContext.files.get(filePath) || '';

          if (!originalCode) {
            throw new Error(`Cannot apply patch: file not found in context: ${filePath}`);
          }

          if (this.config.debug) {
            console.log(`[Executor] Generating modified code for: ${filePath}`);
            console.log(`[Executor] Change description: ${changeDescription}`);
          }

          const modifiedCode = await this.config.llmService.generateModifiedCode({
            originalCode,
            changeDescription,
            filePath,
            language: language || 'typescript',
            sddConstraints: context.sddConstraints,
          });

          // 将修改后的代码添加到参数中
          toolParams = {
            ...toolParams,
            content: modifiedCode,
          };
        }
      }

      // 3. 调用 MCP 工具
      const toolResult = await this.callTool(step.tool, toolParams);

      // 4. 执行后验证
      const postValidation = await this.validateAfterExecution(step, toolResult);

      // 5. 构建结果
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
   * 构建上下文字符串
   */
  private buildContextString(collectedContext: { files: Map<string, string> }): string {
    const parts: string[] = [];

    if (collectedContext.files.size > 0) {
      parts.push('相关文件:');
      for (const [path, content] of collectedContext.files) {
        const truncatedContent = content.length > 1000
          ? content.substring(0, 1000) + '\n... (内容已截断)'
          : content;
        parts.push(`\n--- ${path} ---\n${truncatedContent}`);
      }
    }

    return parts.join('\n');
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
   * 批量执行步骤（Stage 2: 支持动态代码生成）
   */
  async executeSteps(
    steps: ExecutionStep[],
    context: {
      task: AgentTask;
      collectedContext: { files: Map<string, string> };
      sddConstraints?: string;
    },
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

      const output = await this.executeStep(step, context);
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

