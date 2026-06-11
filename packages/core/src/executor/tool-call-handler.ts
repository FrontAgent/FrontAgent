import { deriveAllowRule, type SecurityDecision } from '@frontagent/shared';
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

    const security = await this.enforceSecurity(toolName, args);
    if (!security.allowed) {
      const result = {
        success: false,
        error: security.error,
      };
      return { result, successful: false };
    }

    const mcpStart = this.nowMs();
    const result = await client.callTool(toolName, security.args);
    const mcpDurationMs = this.nowMs() - mcpStart;
    if (typeof result === 'object' && result !== null) {
      (result as Record<string, unknown>).__toolDurationMs = mcpDurationMs;
    }

    if (this.config.debug) {
      console.log('[Executor] Tool result:', result);
    }

    return {
      result,
      successful: this.isSuccessfulToolResult(result),
    };
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

    const response = await this.config.approvalHandler(approvalRequest);
    const approved = typeof response === 'boolean' ? response : response.approved;
    const alwaysAllow = typeof response === 'boolean' ? false : Boolean(response.alwaysAllow);

    if (approved && alwaysAllow && this.config.onPersistAllowRule) {
      this.config.onPersistAllowRule(deriveAllowRule(toolName, args));
    }

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
