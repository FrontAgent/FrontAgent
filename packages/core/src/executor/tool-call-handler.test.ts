import { describe, expect, it, vi } from 'vitest';
import { ExecutorToolCallHandler } from './tool-call-handler.js';
import type { ExecutorConfig, MCPClient } from './types.js';

function makeHandler(overrides: Partial<ExecutorConfig> = {}) {
  const callTool = vi.fn(async () => ({ success: true }));
  const client: MCPClient = {
    callTool,
    listTools: async () => [],
  };

  const config = {
    projectRoot: '/tmp/frontagent-project',
    security: { interactive: true },
    ...overrides,
  } as unknown as ExecutorConfig;

  const handler = new ExecutorToolCallHandler({
    config,
    mcpClients: new Map([['shell', client]]),
    toolToClient: new Map([
      ['run_command', 'shell'],
      ['custom_tool', 'shell'],
    ]),
    nowMs: () => 0,
    getCurrentBrowserUrl: () => undefined,
  });

  return { handler, callTool };
}

describe('ExecutorToolCallHandler approvals', () => {
  it('persists a derived allow rule when the user answers always-allow', async () => {
    const onPersistAllowRule = vi.fn();
    const { handler, callTool } = makeHandler({
      approvalHandler: async () => ({ approved: true, alwaysAllow: true }),
      onPersistAllowRule,
    });

    const result = await handler.callTool('run_command', { command: 'pnpm exec custom-script' });

    expect(result.successful).toBe(true);
    expect(callTool).toHaveBeenCalledOnce();
    expect(onPersistAllowRule).toHaveBeenCalledWith('run_command(pnpm exec custom-script)');
  });

  it('skips approval for the same call within the session after always-allow', async () => {
    const approvalHandler = vi.fn(async () => ({ approved: true, alwaysAllow: true }));
    const { handler, callTool } = makeHandler({
      security: { interactive: true },
      approvalHandler,
    });

    await handler.callTool('run_command', { command: 'pnpm exec custom-script' });
    await handler.callTool('run_command', { command: 'pnpm exec custom-script' });

    expect(approvalHandler).toHaveBeenCalledOnce();
    expect(callTool).toHaveBeenCalledTimes(2);
  });

  it('keeps the in-memory rule literal: a star in the approved command is not a wildcard', async () => {
    const approvalHandler = vi.fn(async () => ({ approved: true, alwaysAllow: true }));
    const { handler } = makeHandler({
      security: { interactive: true },
      approvalHandler,
    });

    await handler.callTool('run_command', { command: 'echo *' });
    await handler.callTool('run_command', { command: 'echo secret' });

    // 第二个不同命令仍需审批
    expect(approvalHandler).toHaveBeenCalledTimes(2);
  });

  it('does not widen authorization when no primary argument can be derived', async () => {
    const onPersistAllowRule = vi.fn();
    const approvalHandler = vi.fn(async () => ({ approved: true, alwaysAllow: true }));
    const { handler, callTool } = makeHandler({
      security: { interactive: true },
      approvalHandler,
      onPersistAllowRule,
    });

    // custom_tool 走 unknown_tool_requires_approval，args 无 command/url/path/selector
    await handler.callTool('custom_tool', { query: 'first' });
    await handler.callTool('custom_tool', { query: 'second' });

    // 无法派生精确规则：不持久化裸工具规则，第二次调用仍需审批
    expect(onPersistAllowRule).not.toHaveBeenCalled();
    expect(approvalHandler).toHaveBeenCalledTimes(2);
    expect(callTool).toHaveBeenCalledTimes(2);
  });

  it('does not persist a rule for plain boolean approvals', async () => {
    const onPersistAllowRule = vi.fn();
    const { handler } = makeHandler({
      approvalHandler: async () => true,
      onPersistAllowRule,
    });

    await handler.callTool('run_command', { command: 'pnpm exec custom-script' });

    expect(onPersistAllowRule).not.toHaveBeenCalled();
  });

  it('rejects when the structured response is not approved', async () => {
    const onPersistAllowRule = vi.fn();
    const { handler, callTool } = makeHandler({
      approvalHandler: async () => ({ approved: false }),
      onPersistAllowRule,
    });

    const result = await handler.callTool('run_command', { command: 'pnpm exec custom-script' });

    expect(result.successful).toBe(false);
    expect(callTool).not.toHaveBeenCalled();
    expect(onPersistAllowRule).not.toHaveBeenCalled();
  });

  it('skips approval entirely when a declarative allow rule matches', async () => {
    const approvalHandler = vi.fn(async () => true);
    const { handler, callTool } = makeHandler({
      security: { interactive: true, permissions: { allow: ['run_command(pnpm exec *)'] } },
      approvalHandler,
    });

    const result = await handler.callTool('run_command', { command: 'pnpm exec custom-script' });

    expect(result.successful).toBe(true);
    expect(callTool).toHaveBeenCalledOnce();
    expect(approvalHandler).not.toHaveBeenCalled();
  });

  it('denies without prompting when a declarative deny rule matches', async () => {
    const approvalHandler = vi.fn(async () => true);
    const { handler, callTool } = makeHandler({
      security: { interactive: true, permissions: { deny: ['run_command(pnpm exec *)'] } },
      approvalHandler,
    });

    const result = await handler.callTool('run_command', { command: 'pnpm exec custom-script' });

    expect(result.successful).toBe(false);
    expect(callTool).not.toHaveBeenCalled();
    expect(approvalHandler).not.toHaveBeenCalled();
  });
});
