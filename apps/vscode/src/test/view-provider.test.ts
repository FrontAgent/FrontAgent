import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as vscode from 'vscode';
import type { ChatMode, ViewState } from '../state.js';
import { FrontAgentViewProvider } from '../view-provider.js';
import { __test } from './vscode-stub.js';

type SendMessage = {
  type: 'send';
  task: string;
  mode: ChatMode;
  files: string[];
  url?: string;
};

interface ProviderInternals {
  state: ViewState;
  view?: { webview: { postMessage: (message: unknown) => void } };
  activeRun?: AbortController;
  runtimeModulePromise?: Promise<unknown>;
  startRun(message: SendMessage): Promise<void>;
  cancelRun(): void;
}

interface CapturedRunOptions {
  signal: AbortSignal;
  onEvent: (event: Record<string, unknown> & { type: string }) => void;
}

interface RunCall {
  options: CapturedRunOptions;
  resolve: (result: unknown) => void;
  reject: (error: unknown) => void;
}

const context = {
  secrets: {
    get: async () => 'test-api-key',
    store: async () => {},
  },
} as unknown as vscode.ExtensionContext;

function makeProvider(): ProviderInternals {
  const provider = new FrontAgentViewProvider(
    context,
    () => {},
    () => {},
  );
  return provider as unknown as ProviderInternals;
}

function fakeRuntime(): { module: unknown; calls: RunCall[] } {
  const calls: RunCall[] = [];
  const module = {
    runFrontAgentTask: (options: CapturedRunOptions) =>
      new Promise((resolve, reject) => {
        calls.push({ options, resolve, reject });
      }),
  };
  return { module, calls };
}

function send(task: string): SendMessage {
  return { type: 'send', task, mode: 'query', files: [] };
}

async function flushMicrotasks(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('FrontAgentViewProvider run lifecycle', () => {
  beforeEach(() => {
    __test.reset();
    __test.workspaceFolders = [{ uri: { fsPath: '/tmp/test-ws' }, name: 'ws', index: 0 }];
    __test.settings.set('provider', 'openai');
    __test.settings.set('model', 'test-model');
    __test.settings.set('baseUrl', 'https://example.com/v1');
  });

  it('clears activeRun when the runtime module fails to load, allowing a retry', async () => {
    const provider = makeProvider();
    const rejected = Promise.reject(new Error('missing bundle'));
    rejected.catch(() => {});
    provider.runtimeModulePromise = rejected;

    await provider.startRun(send('first task'));

    expect(provider.activeRun).toBeUndefined();
    expect(provider.state.isRunning).toBe(false);
    expect(provider.state.error).toContain('missing bundle');

    const { module, calls } = fakeRuntime();
    provider.runtimeModulePromise = Promise.resolve(module);
    await provider.startRun(send('retry task'));

    expect(__test.warnings).toHaveLength(0);
    expect(provider.state.isRunning).toBe(true);
    expect(calls).toHaveLength(1);
  });

  it('still blocks a second send while a run is active', async () => {
    const provider = makeProvider();
    const { module, calls } = fakeRuntime();
    provider.runtimeModulePromise = Promise.resolve(module);

    await provider.startRun(send('first task'));
    await provider.startRun(send('second task'));

    expect(__test.warnings).toEqual(['FrontAgent is already running in this workspace.']);
    expect(calls).toHaveLength(1);
  });

  it('cancelRun clears activeRun immediately and ignores callbacks from the cancelled run', async () => {
    const provider = makeProvider();
    const { module, calls } = fakeRuntime();
    provider.runtimeModulePromise = Promise.resolve(module);

    await provider.startRun(send('first task'));
    expect(provider.state.isRunning).toBe(true);

    provider.cancelRun();
    expect(provider.activeRun).toBeUndefined();
    expect(provider.state.isRunning).toBe(false);
    expect(provider.state.error).toContain('cancelled');
    expect(calls[0]?.options.signal.aborted).toBe(true);

    await provider.startRun(send('second task'));
    expect(__test.warnings).toHaveLength(0);
    expect(provider.state.isRunning).toBe(true);
    expect(calls).toHaveLength(2);

    calls[0]?.reject(new Error('FrontAgent run cancelled by user'));
    await flushMicrotasks();
    expect(provider.state.isRunning).toBe(true);
    expect(provider.activeRun).toBeDefined();

    const labelBefore = provider.state.lastActivityLabel;
    calls[0]?.options.onEvent({ type: 'status_update', label: 'stale', operation: 'stale' });
    expect(provider.state.lastActivityLabel).toBe(labelBefore);
  });
});

describe('FrontAgentViewProvider state posting', () => {
  beforeEach(() => {
    __test.reset();
    __test.workspaceFolders = [{ uri: { fsPath: '/tmp/test-ws' }, name: 'ws', index: 0 }];
    __test.settings.set('provider', 'openai');
    __test.settings.set('model', 'test-model');
    __test.settings.set('baseUrl', 'https://example.com/v1');
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function startWithCapturedPosts(): Promise<{
    provider: ProviderInternals;
    onEvent: CapturedRunOptions['onEvent'];
    resolveRun: (result: unknown) => void;
    posts: unknown[];
  }> {
    const provider = makeProvider();
    const posts: unknown[] = [];
    provider.view = { webview: { postMessage: (message) => posts.push(message) } };
    const { module, calls } = fakeRuntime();
    provider.runtimeModulePromise = Promise.resolve(module);

    await provider.startRun(send('stream task'));
    const call = calls[0];
    if (!call) throw new Error('runFrontAgentTask was not called');
    posts.length = 0;
    return { provider, onEvent: call.options.onEvent, resolveRun: call.resolve, posts };
  }

  it('throttles full-state posts for stream_token events to the trailing edge', async () => {
    const { provider, onEvent, posts } = await startWithCapturedPosts();

    for (let i = 0; i < 25; i += 1) {
      onEvent({ type: 'stream_token', token: `t${i} ` });
    }
    // Inside the throttle window right after startRun's own post: nothing yet.
    expect(posts).toHaveLength(0);

    vi.advanceTimersByTime(50);
    expect(posts).toHaveLength(1);
    expect(provider.state.streamText).toContain('t24');
    const posted = posts[0] as { type: string; state: ViewState };
    expect(posted.type).toBe('state');
    expect(posted.state.streamText).toContain('t24');
  });

  it('posts non-stream events immediately and supersedes a pending stream post', async () => {
    const { onEvent, posts } = await startWithCapturedPosts();

    onEvent({ type: 'stream_token', token: 'hello' });
    expect(posts).toHaveLength(0);

    onEvent({ type: 'status_update', label: 'working', operation: 'op' });
    expect(posts).toHaveLength(1);

    // The immediate post flushed the pending trailing-edge timer.
    vi.advanceTimersByTime(200);
    expect(posts).toHaveLength(1);
  });

  it('applies terminal state exactly once, via events rather than the resolved promise', async () => {
    const { provider, onEvent, resolveRun, posts } = await startWithCapturedPosts();

    onEvent({ type: 'task_failed', error: 'boom from events' });
    expect(provider.state.status).toBe('error');
    expect(provider.state.error).toBe('boom from events');
    const errorMessages = provider.state.messages.filter((message) => message.role === 'error');
    expect(errorMessages).toHaveLength(1);

    resolveRun({ success: false, executedSteps: [], error: 'synthetic resolved error' });
    await vi.advanceTimersByTimeAsync(0);

    // The resolved result must not be re-reduced into a second terminal state.
    expect(provider.state.error).toBe('boom from events');
    expect(provider.state.messages.filter((message) => message.role === 'error')).toHaveLength(1);
    expect(provider.state.isRunning).toBe(false);
    expect(posts.length).toBeGreaterThan(0);
  });
});
