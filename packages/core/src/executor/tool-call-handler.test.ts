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
    mcpClients: new Map([
      ['file', client],
      ['shell', client],
    ]),
    toolToClient: new Map([
      ['read_file', 'file'],
      ['run_command', 'shell'],
      ['custom_tool', 'shell'],
    ]),
    nowMs: () => 0,
    getCurrentBrowserUrl: () => undefined,
  });

  return { handler, callTool };
}

describe('ExecutorToolCallHandler lifecycle hooks', () => {
  it('blocks the tool call when preToolUse returns block', async () => {
    const preToolUse = vi.fn(async () => ({ block: true, reason: 'policy says no' }));
    const { handler, callTool } = makeHandler({ lifecycleHooks: { preToolUse } });

    const result = await handler.callTool('read_file', { path: 'a.ts' });

    expect(result.successful).toBe(false);
    expect((result.result as { error?: string }).error).toContain('policy says no');
    expect(callTool).not.toHaveBeenCalled();
    expect(preToolUse).toHaveBeenCalledWith({
      event: 'preToolUse',
      toolName: 'read_file',
      args: { path: 'a.ts' },
    });
  });

  it('executes the tool and fires postToolUse when preToolUse allows', async () => {
    const postToolUse = vi.fn(async () => {});
    const { handler, callTool } = makeHandler({
      lifecycleHooks: { preToolUse: async () => ({ block: false }), postToolUse },
    });

    const result = await handler.callTool('read_file', { path: 'a.ts' });

    expect(result.successful).toBe(true);
    expect(callTool).toHaveBeenCalledOnce();
    expect(postToolUse).toHaveBeenCalledWith({
      event: 'postToolUse',
      toolName: 'read_file',
      args: { path: 'a.ts' },
      success: true,
      error: undefined,
    });
  });

  it('fires postToolUse with the block reason when preToolUse blocks', async () => {
    const postToolUse = vi.fn(async () => {});
    const { handler } = makeHandler({
      lifecycleHooks: {
        preToolUse: async () => ({ block: true, reason: 'policy says no' }),
        postToolUse,
      },
    });

    await handler.callTool('read_file', { path: 'a.ts' });

    expect(postToolUse).toHaveBeenCalledWith({
      event: 'postToolUse',
      toolName: 'read_file',
      args: { path: 'a.ts' },
      success: false,
      error: expect.stringContaining('policy says no'),
    });
  });

  it('observes a thrown MCP call in postToolUse and rethrows', async () => {
    const postToolUse = vi.fn(async () => {});
    const callTool = vi.fn(async () => {
      throw new Error('mcp transport down');
    });
    const client: MCPClient = { callTool, listTools: async () => [] };
    const config = {
      projectRoot: '/tmp/frontagent-project',
      security: { interactive: false },
      lifecycleHooks: { postToolUse },
    } as unknown as ExecutorConfig;
    const handler = new ExecutorToolCallHandler({
      config,
      mcpClients: new Map([['file', client]]),
      toolToClient: new Map([['read_file', 'file']]),
      nowMs: () => 0,
      getCurrentBrowserUrl: () => undefined,
    });

    await expect(handler.callTool('read_file', { path: 'a.ts' })).rejects.toThrow(
      'mcp transport down',
    );
    expect(postToolUse).toHaveBeenCalledWith({
      event: 'postToolUse',
      toolName: 'read_file',
      args: { path: 'a.ts' },
      success: false,
      error: 'mcp transport down',
    });
  });

  it('passes the tool failure error to postToolUse', async () => {
    const postToolUse = vi.fn(async () => {});
    const callTool = vi.fn(async () => ({ success: false, error: 'disk on fire' }));
    const client: MCPClient = { callTool, listTools: async () => [] };
    const config = {
      projectRoot: '/tmp/frontagent-project',
      security: { interactive: false },
      lifecycleHooks: { postToolUse },
    } as unknown as ExecutorConfig;
    const handler = new ExecutorToolCallHandler({
      config,
      mcpClients: new Map([['file', client]]),
      toolToClient: new Map([['read_file', 'file']]),
      nowMs: () => 0,
      getCurrentBrowserUrl: () => undefined,
    });

    const result = await handler.callTool('read_file', { path: 'a.ts' });

    expect(result.successful).toBe(false);
    expect(postToolUse).toHaveBeenCalledWith({
      event: 'postToolUse',
      toolName: 'read_file',
      args: { path: 'a.ts' },
      success: false,
      error: 'disk on fire',
    });
  });

  it('reports the actually executed args (security-rewritten) to postToolUse', async () => {
    const postToolUse = vi.fn(async () => {});
    const { handler } = makeHandler({
      security: { interactive: true },
      approvalHandler: async () => true,
      lifecycleHooks: { postToolUse },
    });

    // run_command 走审批：安全层会在 args 上追加 __frontagentSecurityApproved
    await handler.callTool('run_command', { command: 'pnpm exec custom-script' });

    expect(postToolUse).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'postToolUse',
        toolName: 'run_command',
        success: true,
        args: expect.objectContaining({
          command: 'pnpm exec custom-script',
          __frontagentSecurityApproved: true,
        }),
      }),
    );
  });

  it('treats a throwing preToolUse hook as non-blocking', async () => {
    const { handler, callTool } = makeHandler({
      lifecycleHooks: {
        preToolUse: async () => {
          throw new Error('hook infra down');
        },
      },
    });

    const result = await handler.callTool('read_file', { path: 'a.ts' });

    expect(result.successful).toBe(true);
    expect(callTool).toHaveBeenCalledOnce();
  });

  it('does not let a throwing postToolUse hook affect the result', async () => {
    const { handler } = makeHandler({
      lifecycleHooks: {
        postToolUse: async () => {
          throw new Error('post hook broke');
        },
      },
    });

    const result = await handler.callTool('read_file', { path: 'a.ts' });
    expect(result.successful).toBe(true);
  });
});

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
