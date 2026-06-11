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
    security: { interactive: false },
    ...overrides,
  } as unknown as ExecutorConfig;

  const handler = new ExecutorToolCallHandler({
    config,
    mcpClients: new Map([['file', client]]),
    toolToClient: new Map([['read_file', 'file']]),
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
