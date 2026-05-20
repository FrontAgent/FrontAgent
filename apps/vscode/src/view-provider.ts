import type { ApprovalRequest } from '@frontagent/runtime-node';
import * as vscode from 'vscode';
import {
  SECRET_API_KEY,
  getWorkspaceFolder,
  normalizeFiles,
  resolveConfigurationStatus,
  resolveRuntimeOptions,
} from './settings-resolve.js';
import {
  type ChatMode,
  type ViewApproval,
  type ViewState,
  appendChatMessage,
  applyPrefill,
  beginChatRun,
  createInitialViewState,
  failChatRun,
  reduceAgentEvent,
  setConfigStatus,
  setDetailsCollapsed,
} from './state.js';
import { getWebviewHtml } from './webview-html.js';

type RuntimeModule = typeof import('@frontagent/runtime-node');

interface PendingApproval {
  approvalId: string;
  resolve: (approved: boolean) => void;
}

export interface PrefillRequest {
  task?: string;
  mode?: ChatMode;
  files?: string[];
  url?: string;
  selectionPreview?: string | null;
}

type WebviewMessage =
  | { type: 'ready' }
  | { type: 'send'; task: string; mode: ChatMode; files: string[]; url?: string }
  | { type: 'stop' }
  | { type: 'approve'; approvalId: string }
  | { type: 'reject'; approvalId: string }
  | { type: 'openLog' }
  | { type: 'configure' }
  | { type: 'saveConfig'; provider: string; model: string; baseUrl: string; apiKey?: string }
  | { type: 'details'; collapsed: boolean }
  | { type: 'webviewError'; message: string; stack?: string };

export class FrontAgentViewProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private state: ViewState = createInitialViewState();
  private pendingPrefill?: PrefillRequest;
  private activeRun?: AbortController;
  private pendingApproval?: PendingApproval;
  private runtimeModulePromise?: Promise<RuntimeModule>;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly log: (message: string) => void,
    private readonly logError: (message: string, error: unknown) => void,
  ) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.log('Resolving FrontAgent webview.');
    this.view = webviewView;
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = getWebviewHtml(webviewView.webview);
    webviewView.webview.onDidReceiveMessage((message: WebviewMessage) => {
      void this.handleMessage(message);
    });
  }

  prefill(request: PrefillRequest): void {
    this.pendingPrefill = request;
    this.state = applyPrefill(this.state, request);
    this.postState();
  }

  async openRunLog(): Promise<void> {
    const runLogPath = this.state.runLogPath;
    if (!runLogPath) {
      vscode.window.showInformationMessage('No FrontAgent run log yet.');
      return;
    }
    const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(runLogPath));
    await vscode.window.showTextDocument(doc, { preview: false });
  }

  async refreshConfigurationStatus(): Promise<void> {
    const folder = vscode.workspace.workspaceFolders?.[0];
    const configStatus = await resolveConfigurationStatus(this.context, folder);
    this.state = setConfigStatus(this.state, configStatus);
    this.postState();
  }

  private async loadRuntimeModule(): Promise<RuntimeModule> {
    if (!this.runtimeModulePromise) {
      this.log('Loading @frontagent/runtime-node.');
      this.runtimeModulePromise = import('@frontagent/runtime-node')
        .then((runtime) => {
          this.log('@frontagent/runtime-node loaded.');
          return runtime;
        })
        .catch((error) => {
          this.runtimeModulePromise = undefined;
          this.logError('@frontagent/runtime-node failed to load.', error);
          throw error;
        });
    }
    return this.runtimeModulePromise;
  }

  private async handleMessage(message: WebviewMessage): Promise<void> {
    switch (message.type) {
      case 'ready':
        await this.refreshConfigurationStatus();
        if (this.pendingPrefill) {
          this.state = applyPrefill(this.state, this.pendingPrefill);
          this.pendingPrefill = undefined;
          this.postState();
        }
        break;
      case 'send':
        await this.startRun(message);
        break;
      case 'stop':
        this.cancelRun();
        break;
      case 'approve':
        this.resolveApproval(message.approvalId, true);
        break;
      case 'reject':
        this.resolveApproval(message.approvalId, false);
        break;
      case 'openLog':
        await this.openRunLog();
        break;
      case 'configure':
        await vscode.commands.executeCommand('frontagent.configure');
        break;
      case 'saveConfig':
        await this.saveInlineConfiguration(message);
        break;
      case 'details':
        this.state = setDetailsCollapsed(this.state, message.collapsed);
        this.postState();
        break;
      case 'webviewError':
        this.logError(
          'Webview error.',
          new Error(`${message.message}${message.stack ? `\n${message.stack}` : ''}`),
        );
        break;
    }
  }

  // PLACEHOLDER_START_RUN

  private async startRun(message: Extract<WebviewMessage, { type: 'send' }>): Promise<void> {
    if (this.activeRun) {
      vscode.window.showWarningMessage('FrontAgent is already running in this workspace.');
      return;
    }

    const folder = getWorkspaceFolder();
    if (!folder) {
      this.state = appendChatMessage(
        this.state,
        'error',
        'Open a workspace folder before running FrontAgent.',
      );
      this.postState();
      return;
    }

    const task = message.task.trim();
    if (!task) {
      this.state = appendChatMessage(this.state, 'error', 'Type a message before sending.');
      this.postState();
      return;
    }

    const configStatus = await resolveConfigurationStatus(this.context, folder);
    this.state = setConfigStatus(this.state, configStatus);
    const files = normalizeFiles(message.files);
    const url = message.url?.trim() || undefined;
    this.state = beginChatRun(this.state, {
      task,
      mode: message.mode,
      files,
      url,
    });
    this.postState();

    if (!configStatus.configured) {
      this.state = failChatRun(
        this.state,
        `FrontAgent is not configured yet. Missing: ${configStatus.missing.join(', ')}.`,
      );
      this.postState();
      return;
    }

    const controller = new AbortController();
    this.activeRun = controller;
    this.pendingApproval = undefined;
    const runtimeOptions = await resolveRuntimeOptions(this.context, folder, configStatus);
    const runtimeTask = this.state.selectionPreview
      ? `${task}\n\nSelected text context:\n${this.state.selectionPreview}`
      : task;
    let runtime: RuntimeModule;
    try {
      runtime = await this.loadRuntimeModule();
    } catch (error) {
      this.state = failChatRun(
        this.state,
        `FrontAgent runtime failed to load: ${error instanceof Error ? error.message : String(error)}`,
      );
      this.postState();
      return;
    }

    this.log(`Starting run. mode=${message.mode}, files=${files.length}, url=${url ?? '(none)'}`);
    void runtime
      .runFrontAgentTask({
        ...runtimeOptions,
        projectRoot: folder.uri.fsPath,
        task: runtimeTask,
        type: message.mode,
        files,
        url,
        runLog: vscode.workspace
          .getConfiguration('frontagent', folder.uri)
          .get<boolean>('runLog.enabled', true),
        codeQualityIsolationMode: 'in_memory',
        filterConsole: true,
        signal: controller.signal,
        onRunLogPath: (runLogPath) => {
          this.state = { ...this.state, runLogPath };
          this.postState();
        },
        onEvent: (event) => {
          if (event.type === 'status_update') {
            this.log(
              `Runtime status: ${event.label}${event.operation ? ` (${event.operation})` : ''}`,
            );
          }
          this.state = reduceAgentEvent(this.state, event);
          this.postState();
        },
        onApprovalRequest: (request) => this.requestApproval(request),
      })
      .then((result) => {
        this.log(
          `Run finished. success=${String(result.success)}, steps=${result.executedSteps.length}`,
        );
        this.state = reduceAgentEvent(this.state, { type: 'task_completed', result });
        this.postState();
      })
      .catch((error) => {
        this.logError('Run failed.', error);
        this.state = failChatRun(
          this.state,
          error instanceof Error ? error.message : String(error),
        );
        this.postState();
      })
      .finally(() => {
        this.activeRun = undefined;
        this.pendingApproval = undefined;
        this.state = { ...this.state, isRunning: false, approval: null };
        this.postState();
      });
  }

  private cancelRun(): void {
    if (!this.activeRun) return;
    this.pendingApproval?.resolve(false);
    this.pendingApproval = undefined;
    this.activeRun.abort(new Error('FrontAgent run cancelled by user'));
    this.state = {
      ...this.state,
      lastActivityLabel: '正在取消',
      currentOperation: '等待当前步骤结束',
      approval: null,
    };
    this.postState();
  }

  private requestApproval(request: ApprovalRequest): Promise<boolean> {
    const approval: ViewApproval = {
      approvalId: request.approvalId,
      toolName: request.toolName,
      riskLevel: request.riskLevel,
      reasonCode: request.reasonCode,
      message: request.message,
      argsSummary: request.argsSummary,
    };
    this.state = { ...this.state, approval };
    this.postState();

    return new Promise((resolve) => {
      this.pendingApproval = { approvalId: request.approvalId, resolve };
    });
  }

  private resolveApproval(approvalId: string, approved: boolean): void {
    if (!this.pendingApproval || this.pendingApproval.approvalId !== approvalId) {
      return;
    }
    this.pendingApproval.resolve(approved);
    this.pendingApproval = undefined;
    this.state = { ...this.state, approval: null };
    this.postState();
  }

  private async saveInlineConfiguration(
    message: Extract<WebviewMessage, { type: 'saveConfig' }>,
  ): Promise<void> {
    const config = vscode.workspace.getConfiguration('frontagent');
    await config.update('provider', message.provider.trim(), vscode.ConfigurationTarget.Workspace);
    await config.update('model', message.model.trim(), vscode.ConfigurationTarget.Workspace);
    await config.update('baseUrl', message.baseUrl.trim(), vscode.ConfigurationTarget.Workspace);

    const apiKey = message.apiKey?.trim();
    if (apiKey) {
      const provider = message.provider.trim() || 'default';
      await this.context.secrets.store(
        provider === 'default' ? SECRET_API_KEY : `${SECRET_API_KEY}.${provider}`,
        apiKey,
      );
    }

    vscode.window.showInformationMessage('FrontAgent configuration updated.');
    await this.refreshConfigurationStatus();
  }

  private postState(): void {
    this.post({ type: 'state', state: this.state });
  }

  private post(message: Record<string, unknown>): void {
    this.view?.webview.postMessage(message);
  }
}
