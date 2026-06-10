import { beforeEach, describe, expect, it } from 'vitest';
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
  activeRun?: AbortController;
  runtimeModulePromise?: Promise<unknown>;
  startRun(message: SendMessage): Promise<void>;
  cancelRun(): void;
}

interface CapturedRunOptions {
  signal: AbortSignal;
  onEvent: (event: { type: string; label?: string; operation?: string }) => void;
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
