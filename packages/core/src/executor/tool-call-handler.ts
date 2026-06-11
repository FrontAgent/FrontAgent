import type { SecurityDecision } from '@frontagent/shared';
import { SecurityManager, toApprovalRequest } from '../security.js';
import type { ExecutorConfig, MCPClient } from './types.js';

type SecurityCheckResult =
  | { allowed: true; args: Record<string, unknown> }
  | { allowed: false; error: string };

export interface ExecutorToolCallHandlerOptions {
  config: ExecutorConfig;
  mcpClients: Map<string, MCPClient>;
  toolToClient: Map<string, string>;
  nowMs: () => number;
  getCurrentBrowserUrl: () => string | undefined;
}

export interface ExecutorToolCallResult {
  result: unknown;
  successful: boolean;
}

export class ExecutorToolCallHandler {
  private readonly config: ExecutorConfig;
  private readonly mcpClients: Map<string, MCPClient>;
  private readonly toolToClient: Map<string, string>;
  private readonly nowMs: () => number;
  private readonly getCurrentBrowserUrl: () => string | undefined;
  private readonly securityManager: SecurityManager;

  constructor(options: ExecutorToolCallHandlerOptions) {
    this.config = options.config;
    this.mcpClients = options.mcpClients;
    this.toolToClient = options.toolToClient;
    this.nowMs = options.nowMs;
    this.getCurrentBrowserUrl = options.getCurrentBrowserUrl;
    this.securityManager = new SecurityManager();
  }

  async callTool(toolName: string, args: Record<string, unknown>): Promise<ExecutorToolCallResult> {
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

    const hookBlock = await this.runPreToolUseHook(toolName, args);
    if (hookBlock) {
      // postToolUse 观察包括 pre-hook 拦截在内的每一种结果
      await this.runPostToolUseHook(toolName, args, false, hookBlock);
      return { result: { success: false, error: hookBlock }, successful: false };
    }

    const security = await this.enforceSecurity(toolName, args);
    if (!security.allowed) {
      const result = {
        success: false,
        error: security.error,
      };
      await this.runPostToolUseHook(toolName, args, false, security.error);
      return { result, successful: false };
    }

    const mcpStart = this.nowMs();
    let result: unknown;
    try {
      result = await client.callTool(toolName, security.args);
    } catch (error) {
      // MCP 调用抛异常的 outcome 同样要被 postToolUse 观察，再保持异常传播
      const message = error instanceof Error ? error.message : String(error);
      await this.runPostToolUseHook(toolName, args, false, message);
      throw error;
    }
    const mcpDurationMs = this.nowMs() - mcpStart;
    if (typeof result === 'object' && result !== null) {
      (result as Record<string, unknown>).__toolDurationMs = mcpDurationMs;
    }

    if (this.config.debug) {
      console.log('[Executor] Tool result:', result);
    }

    const successful = this.isSuccessfulToolResult(result);
    await this.runPostToolUseHook(
      toolName,
      args,
      successful,
      successful ? undefined : this.extractToolResultError(result),
    );

    return {
      result,
      successful,
    };
  }

  /** 从规范化工具结果中提取失败原因，供 postToolUse 观察 */
  private extractToolResultError(result: unknown): string | undefined {
    if (typeof result !== 'object' || result === null) return undefined;
    const resultObj = result as { error?: unknown; message?: unknown };
    if (typeof resultObj.error === 'string' && resultObj.error) return resultObj.error;
    if (typeof resultObj.message === 'string' && resultObj.message) return resultObj.message;
    return undefined;
  }

  /** 返回拦截原因；不拦截时返回 undefined。hook 自身异常按不拦截处理 */
  private async runPreToolUseHook(
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<string | undefined> {
    const hook = this.config.lifecycleHooks?.preToolUse;
    if (!hook) return undefined;

    try {
      const decision = await hook({ event: 'preToolUse', toolName, args });
      if (decision.block) {
        return `preToolUse hook blocked ${toolName}${decision.reason ? `: ${decision.reason}` : ''}`;
      }
    } catch (error) {
      // hook 基础设施故障 fail-open，但必须默认可见，便于发现策略 hook 失效
      console.warn(`[Executor] preToolUse hook errored (non-blocking) for ${toolName}:`, error);
    }
    return undefined;
  }

  private async runPostToolUseHook(
    toolName: string,
    args: Record<string, unknown>,
    success: boolean,
    error?: string,
  ): Promise<void> {
    const hook = this.config.lifecycleHooks?.postToolUse;
    if (!hook) return;

    try {
      await hook({ event: 'postToolUse', toolName, args, success, error });
    } catch (hookError) {
      // 同上：postToolUse 故障默认记录，不中断任务
      console.warn(
        `[Executor] postToolUse hook errored (non-blocking) for ${toolName}:`,
        hookError,
      );
    }
  }

  isSuccessfulToolResult(result: unknown): boolean {
    if (typeof result !== 'object' || result === null) {
      return true;
    }
    const resultObj = result as { success?: boolean };
    return resultObj.success !== false;
  }

  private async enforceSecurity(
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<SecurityCheckResult> {
    const decision = this.securityManager.evaluate({
      toolName,
      args,
      projectRoot: this.config.projectRoot,
      sddConfig: this.config.sddConfig,
      security: this.config.security,
      currentBrowserUrl: this.getCurrentBrowserUrl(),
    });

    this.emitSecurityDecision(decision);

    if (decision.decision === 'deny') {
      return { allowed: false, error: `Security policy denied ${toolName}: ${decision.message}` };
    }

    if (decision.decision === 'allow') {
      return { allowed: true, args };
    }

    const approvalRequest = toApprovalRequest(decision);
    const interactive = this.config.security?.interactive ?? false;
    if (!interactive || !this.config.approvalHandler) {
      const deniedDecision: SecurityDecision = {
        ...decision,
        decision: 'deny',
        reasonCode: 'security_approval_unavailable',
        message: 'Approval is required but no interactive approval channel is available.',
      };
      this.emitSecurityDecision(deniedDecision);
      return { allowed: false, error: deniedDecision.message };
    }

    const approved = await this.config.approvalHandler(approvalRequest);
    const finalDecision: SecurityDecision = approved
      ? {
          ...decision,
          decision: 'allow',
          reasonCode: 'approved_by_user',
          message: `User approved: ${decision.message}`,
          approvalId: approvalRequest.approvalId,
        }
      : {
          ...decision,
          decision: 'deny',
          reasonCode: 'rejected_by_user',
          message: `User rejected: ${decision.message}`,
          approvalId: approvalRequest.approvalId,
        };
    this.emitSecurityDecision(finalDecision);

    if (!approved) {
      return {
        allowed: false,
        error: `Security approval rejected for ${toolName}: ${decision.message}`,
      };
    }

    return {
      allowed: true,
      args: {
        ...args,
        __frontagentSecurityApproved: true,
      },
    };
  }

  private emitSecurityDecision(decision: SecurityDecision): void {
    if (this.config.security?.auditEnabled === false) {
      return;
    }
    this.config.onSecurityDecision?.(decision);
  }
}
