/**
 * @frontagent/core - FrontAgent 核心模块
 */

export { FrontAgent, createAgent } from './agent.js';
export { Planner, createPlanner, type PlannerConfig } from './planner.js';
export { Executor, createExecutor, type ExecutorConfig, type MCPClient } from './executor.js';
export { ContextManager, createContextManager } from './context.js';

export type {
  AgentConfig,
  LLMConfig,
  MCPConfig,
  HallucinationGuardConfig,
  AgentContext,
  ContextInfo,
  Message,
  ToolCall,
  ToolResult,
  PlannerOutput,
  ContextRequest,
  ExecutorOutput,
  AgentExecutionResult,
  AgentEvent,
  AgentEventListener
} from './types.js';

