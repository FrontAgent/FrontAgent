/**
 * `fa run` command — Ink TUI shell over the shared Node runtime.
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { runFrontAgentTask } from '@frontagent/runtime-node';
import chalk from 'chalk';
import { render } from 'ink';
import { createEventBridge } from '../ui/bridge.js';
import { App } from '../ui/components/App.js';
import { createStore } from '../ui/store.js';

type TokenListener = (token: string) => void;

function createStreamTokenEmitter() {
  const listeners = new Set<TokenListener>();
  return {
    emit(token: string) {
      for (const l of listeners) l(token);
    },
    subscribe(cb: TokenListener) {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
  };
}

function isDebugEnabled(value: unknown): boolean {
  return value === true || value === 'true' || value === '1';
}

export default async function runCommand(task: string, options: Record<string, any>) {
  const projectRoot = process.cwd();
  const sddPath = resolve(projectRoot, options.sdd);
  const debug = isDebugEnabled(options.debug);
  const canPromptForApproval = process.stdin.isTTY !== false;

  if (!existsSync(sddPath) && debug) {
    console.log(chalk.yellow(`⚠️ SDD 配置文件不存在: ${sddPath}`));
    console.log(chalk.gray('   运行 fa init 创建配置文件'));
    console.log(chalk.gray('   将在无约束模式下运行\n'));
  }

  const store = createStore();
  store.setState({ debug });

  const streamTokenEmitter = createStreamTokenEmitter();
  const eventBridge = createEventBridge(store);
  const inkInstance = render(<App store={store} streamTokenEmitter={streamTokenEmitter} />);

  try {
    const result = await runFrontAgentTask({
      ...options,
      projectRoot,
      task,
      sddPath: options.sdd,
      type: options.type,
      files: options.files,
      url: options.url,
      runLog: options.runLog,
      filterConsole: true,
      debug,
      onRunLogPath: (runLogPath) => {
        if (runLogPath) {
          store.setState({ runLogPath });
        }
      },
      onApprovalRequest: (request) => {
        if (!canPromptForApproval) {
          store.recordActivity('审批不可交互，已拒绝工具执行', request.toolName);
          return Promise.resolve(false);
        }

        return new Promise<boolean>((resolveApproval) => {
          store.setState({
            approval: {
              approvalId: request.approvalId,
              toolName: request.toolName,
              riskLevel: request.riskLevel,
              reasonCode: request.reasonCode,
              message: request.message,
              argsSummary: request.argsSummary,
              resolve: resolveApproval,
            },
          });
        });
      },
      onEvent: (event) => {
        eventBridge(event);
        if (event.type === 'stream_token') {
          streamTokenEmitter.emit(event.token);
        }
      },
    });

    store.setState({
      status: result.success ? 'done' : 'error',
      result,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    store.setState({
      status: 'error',
      result: {
        success: false,
        taskId: '',
        executedSteps: [],
        error: errorMessage,
        duration: 0,
        validations: [],
      },
    });
  } finally {
    store.recordActivity('收尾完成', null);
    await new Promise((r) => setTimeout(r, 100));
    inkInstance.unmount();
  }
}
