/**
 * A2A (Agent-to-Agent) 协议定义与内存总线实现
 * 用于主 Agent 与 SubAgent 的结构化通信
 */

import { generateId } from "@frontagent/shared";

export const A2A_PROTOCOL_NAME = "A2A" as const;
export const A2A_PROTOCOL_VERSION = "1.0" as const;

// 所有消息公共头
export interface A2AEnvelope {
  protocol: typeof A2A_PROTOCOL_NAME;
  version: typeof A2A_PROTOCOL_VERSION;
  messageId: string;
  timestamp: number;
  from: string;
  to: string;
  intent: string; // 要做什么动作
}

// 请求消息
export interface A2ARequest<TPayload = unknown> extends A2AEnvelope {
  kind: "request";
  payload: TPayload;
}

// 响应消息
export interface A2AResponse<TPayload = unknown> extends A2AEnvelope {
  kind: "response";
  inReplyTo: string;
  success: boolean;
  payload?: TPayload;
  error?: string;
}

// 子Agent要实现的接口: ID, 支持的intent列表, 处理函数
export interface A2AAgent<TRequest = unknown, TResponse = unknown> {
  agentId: string;
  capabilities: string[];
  handleRequest(request: A2ARequest<TRequest>): Promise<A2AResponse<TResponse>>;
}

// 请求响应总线，实现点对点传输
export class InMemoryA2ABus {
  private readonly agents = new Map<string, A2AAgent<unknown, unknown>>();

  // 注册：防止ID重复
  registerAgent(agent: A2AAgent<unknown, unknown>): void {
    if (this.agents.has(agent.agentId)) {
      throw new Error(`A2A agent already registered: ${agent.agentId}`);
    }
    this.agents.set(agent.agentId, agent);
  }

  hasAgent(agentId: string): boolean {
    return this.agents.has(agentId);
  }

  async request<TRequest, TResponse>(params: {
    from: string;
    to: string;
    intent: string;
    payload: TRequest;
  }): Promise<A2AResponse<TResponse>> {
    const { from, to, intent, payload } = params;

    const request: A2ARequest<TRequest> = {
      protocol: A2A_PROTOCOL_NAME,
      version: A2A_PROTOCOL_VERSION,
      kind: "request",
      messageId: generateId("a2a-req"),
      timestamp: Date.now(),
      from,
      to,
      intent,
      payload,
    };

    const target = this.agents.get(to);
    if (!target) {
      return {
        protocol: A2A_PROTOCOL_NAME,
        version: A2A_PROTOCOL_VERSION,
        kind: "response",
        messageId: generateId("a2a-res"),
        inReplyTo: request.messageId,
        timestamp: Date.now(),
        from: to,
        to: from,
        intent,
        success: false,
        error: `A2A target not found: ${to}`,
      };
    }

    if (!target.capabilities.includes(intent)) {
      return {
        protocol: A2A_PROTOCOL_NAME,
        version: A2A_PROTOCOL_VERSION,
        kind: "response",
        messageId: generateId("a2a-res"),
        inReplyTo: request.messageId,
        timestamp: Date.now(),
        from: to,
        to: from,
        intent,
        success: false,
        error: `A2A target ${to} does not support intent: ${intent}`,
      };
    }

    try {
      const response = await target.handleRequest(
        request as A2ARequest<unknown>,
      );
      return {
        ...response,
        protocol: A2A_PROTOCOL_NAME,
        version: A2A_PROTOCOL_VERSION,
        kind: "response",
        inReplyTo: request.messageId,
        intent,
        from: response.from || to,
        to: response.to || from,
      } as A2AResponse<TResponse>;
    } catch (error) {
      return {
        protocol: A2A_PROTOCOL_NAME,
        version: A2A_PROTOCOL_VERSION,
        kind: "response",
        messageId: generateId("a2a-res"),
        inReplyTo: request.messageId,
        timestamp: Date.now(),
        from: to,
        to: from,
        intent,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
