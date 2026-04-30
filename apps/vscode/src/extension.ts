import * as vscode from 'vscode';
import {
  initSddConfig,
  runFrontAgentTask,
  validateSddConfig,
  type ApprovalRequest,
  type RuntimeConfigInput,
} from '@frontagent/runtime-node';
import { resolveConfigStatusFromSources } from './settings.js';
import {
  appendChatMessage,
  applyPrefill,
  beginChatRun,
  createInitialViewState,
  failChatRun,
  reduceAgentEvent,
  setConfigStatus,
  setDetailsCollapsed,
  type ChatMode,
  type ConfigStatus,
  type ViewApproval,
  type ViewState,
} from './state.js';

const VIEW_ID = 'frontagent.taskView';
const SECRET_API_KEY = 'frontagent.apiKey';

type WebviewMessage =
  | { type: 'ready' }
  | { type: 'send'; task: string; mode: ChatMode; files: string[]; url?: string }
  | { type: 'stop' }
  | { type: 'approve'; approvalId: string }
  | { type: 'reject'; approvalId: string }
  | { type: 'openLog' }
  | { type: 'configure' }
  | { type: 'saveConfig'; provider: string; model: string; baseUrl: string; apiKey?: string }
  | { type: 'details'; collapsed: boolean };

interface PendingApproval {
  approvalId: string;
  resolve: (approved: boolean) => void;
}

interface PrefillRequest {
  task?: string;
  mode?: ChatMode;
  files?: string[];
  url?: string;
  selectionPreview?: string | null;
}

export function activate(context: vscode.ExtensionContext) {
  const provider = new FrontAgentViewProvider(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(VIEW_ID, provider, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
    vscode.commands.registerCommand('frontagent.run', async () => {
      await revealFrontAgentView();
      provider.prefill({});
    }),
    vscode.commands.registerCommand('frontagent.runCurrentFile', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active editor.');
        return;
      }
      await revealFrontAgentView();
      provider.prefill({
        files: [vscode.workspace.asRelativePath(editor.document.uri)],
      });
    }),
    vscode.commands.registerCommand('frontagent.runSelection', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active editor.');
        return;
      }
      const selection = editor.document.getText(editor.selection).trim();
      if (!selection) {
        vscode.window.showWarningMessage('No selected text.');
        return;
      }
      await revealFrontAgentView();
      provider.prefill({
        mode: 'modify',
        files: [vscode.workspace.asRelativePath(editor.document.uri)],
        selectionPreview: selection.length > 2400 ? `${selection.slice(0, 2400)}...` : selection,
      });
    }),
    vscode.commands.registerCommand('frontagent.initSdd', async () => {
      const folder = getWorkspaceFolder();
      if (!folder) return;
      const result = initSddConfig(folder.uri.fsPath);
      if (result.created) {
        vscode.window.showInformationMessage(result.message);
        const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(result.path));
        await vscode.window.showTextDocument(doc);
      } else {
        vscode.window.showWarningMessage(result.message);
      }
    }),
    vscode.commands.registerCommand('frontagent.validateSdd', async () => {
      const folder = getWorkspaceFolder();
      if (!folder) return;
      const result = validateSddConfig(folder.uri.fsPath);
      if (result.success) {
        vscode.window.showInformationMessage(
          `SDD valid: ${result.projectName ?? '(unknown)'} · ${result.framework ?? ''} ${result.frameworkVersion ?? ''}`.trim(),
        );
      } else {
        vscode.window.showErrorMessage(`SDD invalid: ${(result.errors ?? []).join('; ')}`);
      }
    }),
    vscode.commands.registerCommand('frontagent.openRunLog', async () => {
      await provider.openRunLog();
    }),
    vscode.commands.registerCommand('frontagent.configure', async () => {
      await configureFrontAgent(context);
      await provider.refreshConfigurationStatus();
    }),
  );
}

export function deactivate() {}

class FrontAgentViewProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private state: ViewState = createInitialViewState();
  private pendingPrefill?: PrefillRequest;
  private activeRun?: AbortController;
  private pendingApproval?: PendingApproval;

  constructor(private readonly context: vscode.ExtensionContext) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
    };
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
    }
  }

  private async startRun(message: Extract<WebviewMessage, { type: 'send' }>): Promise<void> {
    if (this.activeRun) {
      vscode.window.showWarningMessage('FrontAgent is already running in this workspace.');
      return;
    }

    const folder = getWorkspaceFolder();
    if (!folder) {
      this.state = appendChatMessage(this.state, 'error', 'Open a workspace folder before running FrontAgent.');
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

    void runFrontAgentTask({
      ...runtimeOptions,
      projectRoot: folder.uri.fsPath,
      task: runtimeTask,
      type: message.mode,
      files,
      url,
      runLog: vscode.workspace.getConfiguration('frontagent', folder.uri).get<boolean>('runLog.enabled', true),
      codeQualityIsolationMode: 'in_memory',
      filterConsole: true,
      signal: controller.signal,
      onRunLogPath: (runLogPath) => {
        this.state = { ...this.state, runLogPath };
        this.postState();
      },
      onEvent: (event) => {
        this.state = reduceAgentEvent(this.state, event);
        this.postState();
      },
      onApprovalRequest: (request) => this.requestApproval(request),
    }).then((result) => {
      this.state = reduceAgentEvent(this.state, { type: 'task_completed', result });
      this.postState();
    }).catch((error) => {
      this.state = failChatRun(this.state, error instanceof Error ? error.message : String(error));
      this.postState();
    }).finally(() => {
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
      this.pendingApproval = {
        approvalId: request.approvalId,
        resolve,
      };
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

  private async saveInlineConfiguration(message: Extract<WebviewMessage, { type: 'saveConfig' }>): Promise<void> {
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

async function revealFrontAgentView(): Promise<void> {
  await vscode.commands.executeCommand('workbench.view.extension.frontagent');
  try {
    await vscode.commands.executeCommand(`${VIEW_ID}.focus`);
  } catch {
    // Some Extension Host builds expose the generated focus command after the view is resolved.
  }
}

function getWorkspaceFolder(): vscode.WorkspaceFolder | undefined {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    vscode.window.showWarningMessage('Open a workspace folder before using FrontAgent.');
  }
  return folder;
}

async function resolveConfigurationStatus(
  context: vscode.ExtensionContext,
  folder?: vscode.WorkspaceFolder,
): Promise<ConfigStatus> {
  const config = vscode.workspace.getConfiguration('frontagent', folder?.uri);
  const provider = emptyToUndefined(config.get<string>('provider'));
  const envProvider = emptyToUndefined(process.env.PROVIDER)?.toLowerCase();
  const providerForSecret = provider ?? (envProvider === 'openai' || envProvider === 'anthropic' ? envProvider : undefined);
  const providerApiKey = providerForSecret ? await context.secrets.get(`${SECRET_API_KEY}.${providerForSecret}`) : undefined;
  const legacyApiKey = await context.secrets.get(SECRET_API_KEY);
  return resolveConfigStatusFromSources({
    settings: {
      provider,
      model: emptyToUndefined(config.get<string>('model')),
      baseUrl: emptyToUndefined(config.get<string>('baseUrl')),
    },
    secrets: {
      providerApiKey,
      legacyApiKey,
    },
    env: process.env,
  });
}

async function resolveRuntimeOptions(
  context: vscode.ExtensionContext,
  folder: vscode.WorkspaceFolder,
  status: ConfigStatus,
): Promise<RuntimeConfigInput & { debug?: boolean }> {
  const config = vscode.workspace.getConfiguration('frontagent', folder.uri);
  const providerApiKey = status.provider ? await context.secrets.get(`${SECRET_API_KEY}.${status.provider}`) : undefined;
  const legacyApiKey = await context.secrets.get(SECRET_API_KEY);
  const providerEnvApiKey = status.provider ? process.env[`${status.provider.toUpperCase()}_API_KEY`] : undefined;
  return {
    provider: status.provider ?? undefined,
    model: status.model ?? undefined,
    baseUrl: status.baseUrl ?? undefined,
    apiKey: providerApiKey ?? legacyApiKey ?? providerEnvApiKey ?? process.env.API_KEY,
    maxTokens: config.get<number>('maxTokens', 4096),
    temperature: config.get<number>('temperature', 0.7),
    securityMode: config.get<string>('securityMode', 'balanced'),
    disableRag: !config.get<boolean>('rag.enabled', true),
    ragRepo: config.get<string>('rag.repo', 'https://github.com/ceilf6/Lab.git'),
    ragBranch: config.get<string>('rag.branch', 'main'),
  };
}

function emptyToUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeFiles(files: string[]): string[] {
  return [...new Set(files.map((file) => file.trim()).filter(Boolean))];
}

async function configureFrontAgent(context: vscode.ExtensionContext): Promise<void> {
  const config = vscode.workspace.getConfiguration('frontagent');
  const currentProvider = emptyToUndefined(config.get<string>('provider'));
  const provider = await vscode.window.showQuickPick(['openai', 'anthropic'], {
    title: 'FrontAgent provider',
    placeHolder: 'Choose LLM provider',
  });
  if (!provider) return;
  await config.update('provider', provider, vscode.ConfigurationTarget.Workspace);

  const model = await vscode.window.showInputBox({
    title: 'FrontAgent model',
    prompt: 'Model name, for example zai-org/GLM-4.6.',
    value: config.get<string>('model', ''),
  });
  if (model !== undefined) {
    await config.update('model', model.trim(), vscode.ConfigurationTarget.Workspace);
  }

  const baseUrl = await vscode.window.showInputBox({
    title: 'FrontAgent base URL',
    prompt: 'OpenAI-compatible or Anthropic-compatible base URL, for example https://api.siliconflow.cn/v1.',
    value: config.get<string>('baseUrl', ''),
  });
  if (baseUrl !== undefined) {
    await config.update('baseUrl', baseUrl.trim(), vscode.ConfigurationTarget.Workspace);
  }

  const apiKey = await vscode.window.showInputBox({
    title: 'FrontAgent API key',
    prompt: 'Stored in VS Code SecretStorage.',
    password: true,
    ignoreFocusOut: true,
  });
  if (apiKey) {
    await context.secrets.store(`${SECRET_API_KEY}.${provider}`, apiKey);
    if (!currentProvider) {
      await context.secrets.store(SECRET_API_KEY, apiKey);
    }
  }

  vscode.window.showInformationMessage('FrontAgent configuration updated.');
}

function nonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let value = '';
  for (let i = 0; i < 32; i++) {
    value += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return value;
}

function getWebviewHtml(webview: vscode.Webview): string {
  const scriptNonce = nonce();
  const styleNonce = nonce();
  const csp = [
    `default-src 'none'`,
    `style-src ${webview.cspSource} 'nonce-${styleNonce}'`,
    `script-src 'nonce-${scriptNonce}'`,
  ].join('; ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style nonce="${styleNonce}">
    :root {
      color-scheme: light dark;
      --gap: 10px;
      --radius: 6px;
      --accent: var(--vscode-button-background);
      --border: var(--vscode-panel-border);
      --muted: var(--vscode-descriptionForeground);
      --surface: var(--vscode-sideBar-background);
      --field: var(--vscode-input-background);
      --field-border: var(--vscode-input-border);
      --danger: var(--vscode-errorForeground);
      --ok: var(--vscode-testing-iconPassed);
      --bubble: var(--vscode-editor-background);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: var(--vscode-foreground);
      background: var(--surface);
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
    }
    .shell {
      display: grid;
      grid-template-rows: auto 1fr auto;
      height: 100vh;
      min-height: 0;
    }
    .top {
      display: grid;
      gap: 10px;
      padding: 10px 12px;
      border-bottom: 1px solid var(--border);
    }
    .bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
    }
    .title { font-weight: 700; letter-spacing: 0; }
    .status { color: var(--muted); font-size: 12px; white-space: nowrap; }
    .config-banner {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 8px;
      align-items: center;
      color: var(--muted);
      font-size: 12px;
    }
    .config-banner.ready { color: var(--ok); }
    .config-form {
      display: none;
      gap: 8px;
      padding-top: 2px;
    }
    .config-form.open { display: grid; }
    label { display: grid; gap: 5px; color: var(--muted); font-size: 12px; }
    textarea, input, select {
      width: 100%;
      color: var(--vscode-input-foreground);
      background: var(--field);
      border: 1px solid var(--field-border, var(--border));
      border-radius: var(--radius);
      padding: 7px 8px;
      font: inherit;
    }
    button {
      border: 0;
      border-radius: var(--radius);
      padding: 7px 10px;
      font: inherit;
      color: var(--vscode-button-foreground);
      background: var(--vscode-button-background);
      cursor: pointer;
      min-height: 30px;
    }
    button.secondary {
      color: var(--vscode-button-secondaryForeground);
      background: var(--vscode-button-secondaryBackground);
    }
    button:disabled { opacity: 0.55; cursor: not-allowed; }
    .messages {
      min-height: 0;
      overflow: auto;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .empty {
      color: var(--muted);
      border: 1px dashed var(--border);
      border-radius: var(--radius);
      padding: 12px;
      line-height: 1.5;
    }
    .message {
      display: grid;
      gap: 5px;
      max-width: 100%;
    }
    .message.user { justify-items: end; }
    .role {
      color: var(--muted);
      font-size: 11px;
      text-transform: uppercase;
    }
    .bubble {
      width: fit-content;
      max-width: 100%;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 8px 9px;
      background: var(--bubble);
      white-space: pre-wrap;
      line-height: 1.45;
    }
    .user .bubble {
      color: var(--vscode-button-foreground);
      background: var(--vscode-button-background);
      border-color: transparent;
    }
    .error .bubble { color: var(--danger); }
    .meta {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
      justify-content: flex-end;
    }
    .chip {
      color: var(--muted);
      border: 1px solid var(--border);
      border-radius: 999px;
      padding: 2px 7px;
      font-size: 11px;
      line-height: 1.6;
    }
    .draft {
      border-left: 2px solid var(--accent);
      padding-left: 8px;
      white-space: pre-wrap;
      color: var(--vscode-foreground);
    }
    .approval {
      border: 1px solid var(--vscode-editorWarning-foreground);
      border-radius: var(--radius);
      padding: 9px;
      display: grid;
      gap: 8px;
      background: var(--bubble);
    }
    .approval-actions,
    .config-actions,
    .composer-actions {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .composer {
      display: grid;
      gap: 8px;
      padding: 10px 12px 12px;
      border-top: 1px solid var(--border);
      background: var(--surface);
    }
    .mode-row {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 6px;
    }
    .mode-button.active {
      outline: 1px solid var(--accent);
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }
    .context-row {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      min-height: 24px;
      align-items: center;
    }
    .context-row .chip button {
      min-height: 0;
      margin-left: 5px;
      padding: 0;
      color: inherit;
      background: transparent;
    }
    .selection {
      color: var(--muted);
      border-left: 2px solid var(--border);
      padding-left: 8px;
      max-height: 72px;
      overflow: auto;
      white-space: pre-wrap;
      font-size: 12px;
    }
    #prompt {
      min-height: 76px;
      max-height: 180px;
      resize: vertical;
      line-height: 1.45;
    }
    details {
      border-top: 1px solid var(--border);
      padding-top: 8px;
    }
    details summary {
      cursor: pointer;
      color: var(--muted);
      font-size: 12px;
      text-transform: uppercase;
      margin-bottom: 8px;
    }
    .details-grid {
      display: grid;
      gap: 8px;
    }
    .activity {
      border-left: 2px solid var(--accent);
      padding: 6px 8px;
      background: var(--bubble);
    }
    .phase {
      border: 1px solid var(--border);
      border-radius: var(--radius);
      overflow: hidden;
    }
    .phase-head {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      padding: 7px 8px;
      background: var(--bubble);
    }
    .steps { display: grid; }
    .step {
      display: grid;
      grid-template-columns: 72px 1fr;
      gap: 8px;
      padding: 7px 8px;
      border-top: 1px solid var(--border);
    }
    .badge {
      color: var(--muted);
      font-size: 11px;
      text-transform: uppercase;
    }
    .badge.completed { color: var(--ok); }
    .badge.failed { color: var(--danger); }
    .mono, pre { font-family: var(--vscode-editor-font-family); }
    pre {
      margin: 0;
      max-height: 180px;
      overflow: auto;
      white-space: pre-wrap;
      background: var(--bubble);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 8px;
    }
    .muted { color: var(--muted); }
    .danger { color: var(--danger); }
    .hidden { display: none; }
  </style>
</head>
<body>
  <div class="shell">
    <header class="top">
      <div class="bar">
        <div class="title">FrontAgent</div>
        <div id="status" class="status">Idle</div>
      </div>
      <div id="configBanner" class="config-banner">
        <span id="configText">Checking configuration...</span>
        <button id="toggleConfig" class="secondary" type="button">Configure</button>
      </div>
      <form id="configForm" class="config-form">
        <label>Provider
          <select id="configProvider">
            <option value="">Select provider</option>
            <option value="openai">OpenAI-compatible</option>
            <option value="anthropic">Anthropic</option>
          </select>
        </label>
        <label>Model
          <input id="configModel" placeholder="zai-org/GLM-4.6">
        </label>
        <label>Base URL
          <input id="configBaseUrl" placeholder="https://api.siliconflow.cn/v1">
        </label>
        <label>API Key
          <input id="configApiKey" type="password" placeholder="Stored in SecretStorage">
        </label>
        <div class="config-actions">
          <button id="saveConfig" type="submit">Save</button>
          <button id="openCommandConfig" class="secondary" type="button">Command</button>
        </div>
      </form>
    </header>

    <main id="messages" class="messages"></main>

    <form id="composer" class="composer">
      <div class="mode-row">
        <button class="secondary mode-button active" type="button" data-mode="query">Ask</button>
        <button class="secondary mode-button" type="button" data-mode="modify">Edit</button>
        <button class="secondary mode-button" type="button" data-mode="debug">Debug</button>
      </div>
      <div id="contextFiles" class="context-row"></div>
      <div id="selectionPreview" class="selection hidden"></div>
      <label>Browser URL
        <input id="browserUrl" placeholder="http://localhost:5173">
      </label>
      <textarea id="prompt" placeholder="Ask FrontAgent to explain, edit, or debug this workspace..."></textarea>
      <div class="composer-actions">
        <button id="sendButton" type="submit">Send</button>
        <button id="stopButton" class="secondary" type="button">Stop</button>
      </div>
      <details id="detailsPanel">
        <summary>Run details</summary>
        <div class="details-grid">
          <div class="activity">
            <div id="activityLabel">等待开始</div>
            <div id="operation" class="muted"></div>
          </div>
          <button id="logButton" class="secondary" type="button">Open log</button>
          <div>
            <div class="muted">Plan <span id="phaseCount"></span></div>
            <div id="phases" class="muted">No plan yet.</div>
          </div>
          <div>
            <div class="muted">Knowledge <span id="ragMeta"></span></div>
            <div id="rag" class="muted">No matches yet.</div>
          </div>
        </div>
      </details>
    </form>
  </div>

  <script nonce="${scriptNonce}">
    const vscode = acquireVsCodeApi();
    let state = null;
    let activeMode = 'query';
    let lastComposer = '';
    let lastBrowserUrl = '';
    const $ = (id) => document.getElementById(id);
    const prompt = $('prompt');
    const browserUrl = $('browserUrl');
    const detailsPanel = $('detailsPanel');

    function render(next) {
      state = next;
      activeMode = next.mode || activeMode;
      $('status').textContent = next.status;
      $('sendButton').disabled = next.isRunning || !next.configStatus.configured;
      $('stopButton').disabled = !next.isRunning;
      renderConfig(next.configStatus);
      renderMode();
      renderContext(next);
      renderMessages(next);
      renderDetails(next);
      if (next.composer !== lastComposer) {
        prompt.value = next.composer || '';
        lastComposer = next.composer || '';
      }
      if (next.browserUrl !== lastBrowserUrl) {
        browserUrl.value = next.browserUrl || '';
        lastBrowserUrl = next.browserUrl || '';
      }
    }

    function renderConfig(config) {
      const missing = config.missing || [];
      $('configBanner').className = config.configured ? 'config-banner ready' : 'config-banner';
      $('configText').textContent = config.configured
        ? \`\${config.provider} · \${config.model}\`
        : \`Missing \${missing.join(', ')}\`;
      if (document.activeElement !== $('configProvider')) $('configProvider').value = config.provider || '';
      if (document.activeElement !== $('configModel')) $('configModel').value = config.model || '';
      if (document.activeElement !== $('configBaseUrl')) $('configBaseUrl').value = config.baseUrl || '';
    }

    function renderMode() {
      document.querySelectorAll('.mode-button').forEach((button) => {
        button.classList.toggle('active', button.getAttribute('data-mode') === activeMode);
      });
    }

    function renderContext(next) {
      $('contextFiles').innerHTML = next.contextFiles.length
        ? next.contextFiles.map((file) => \`<span class="chip">\${escapeHtml(file)}<button type="button" data-remove-file="\${escapeHtml(file)}">x</button></span>\`).join('')
        : '<span class="muted">No files attached</span>';
      $('selectionPreview').className = next.selectionPreview ? 'selection' : 'selection hidden';
      $('selectionPreview').textContent = next.selectionPreview ? \`Selection context:\\n\${next.selectionPreview}\` : '';
    }

    function renderMessages(next) {
      const parts = [];
      if (!next.messages.length && !next.streamText && !next.approval) {
        parts.push('<div class="empty">Chat with FrontAgent from this sidebar. Configure your provider, attach a file or selection, then ask a question or request an edit.</div>');
      }
      for (const message of next.messages) {
        const meta = [];
        if (message.mode) meta.push(message.mode);
        for (const file of message.files || []) meta.push(file);
        if (message.url) meta.push(message.url);
        parts.push(\`
          <div class="message \${escapeHtml(message.role)}">
            <div class="role">\${escapeHtml(message.role)}</div>
            <div class="bubble">\${escapeHtml(message.text)}</div>
            \${meta.length ? \`<div class="meta">\${meta.map((item) => \`<span class="chip">\${escapeHtml(item)}</span>\`).join('')}</div>\` : ''}
          </div>\`);
      }
      if (next.streamText) {
        parts.push(\`<div class="message assistant"><div class="role">assistant</div><div class="draft">\${escapeHtml(next.streamText)}</div></div>\`);
      }
      if (next.approval) {
        parts.push(\`
          <div class="approval">
            <strong>Approval required: \${escapeHtml(next.approval.toolName)}</strong>
            <div class="muted">\${escapeHtml(next.approval.riskLevel)} · \${escapeHtml(next.approval.reasonCode)}</div>
            <div>\${escapeHtml(next.approval.message)}</div>
            <pre>\${escapeHtml(next.approval.argsSummary)}</pre>
            <div class="approval-actions">
              <button data-approve="\${escapeHtml(next.approval.approvalId)}" type="button">Approve</button>
              <button class="secondary" data-reject="\${escapeHtml(next.approval.approvalId)}" type="button">Reject</button>
            </div>
          </div>\`);
      }
      $('messages').innerHTML = parts.join('');
      $('messages').scrollTop = $('messages').scrollHeight;
    }

    function renderDetails(next) {
      detailsPanel.open = !next.detailsCollapsed;
      $('activityLabel').textContent = next.lastActivityLabel || '等待开始';
      $('operation').textContent = next.currentOperation || '';
      $('phaseCount').textContent = next.phases.length ? \`(\${next.phases.length})\` : '';
      $('phases').innerHTML = next.phases.length ? next.phases.map((phase) => \`
        <div class="phase">
          <div class="phase-head">
            <strong>\${escapeHtml(phase.name)}</strong>
            <span class="badge \${escapeHtml(phase.status)}">\${escapeHtml(phase.status)}</span>
          </div>
          <div class="steps">
            \${phase.steps.map((step) => \`
              <div class="step">
                <span class="badge \${escapeHtml(step.status)}">\${escapeHtml(step.status)}</span>
                <div>
                  <div>\${escapeHtml(step.description)}</div>
                  <div class="muted mono">\${escapeHtml(step.tool)} · \${escapeHtml(step.action)}</div>
                  \${step.error ? \`<div class="danger">\${escapeHtml(step.error)}</div>\` : ''}
                </div>
              </div>\`).join('')}
          </div>
        </div>\`).join('') : 'No plan yet.';
      $('ragMeta').textContent = next.ragSearchMode ? \`\${next.ragSearchMode}\${next.ragReranked ? ' · reranked' : ''}\` : '';
      $('rag').innerHTML = next.ragMatches.length
        ? next.ragMatches.map((match) => \`<div><strong>\${escapeHtml(match.title)}</strong><div class="muted mono">\${escapeHtml(match.path || '')}</div></div>\`).join('')
        : 'No matches yet.';
    }

    function escapeHtml(value) {
      return String(value ?? '').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[char]));
    }

    $('composer').addEventListener('submit', (event) => {
      event.preventDefault();
      const task = prompt.value.trim();
      if (!task) return;
      vscode.postMessage({
        type: 'send',
        task,
        mode: activeMode,
        files: state?.contextFiles || [],
        url: browserUrl.value.trim() || undefined
      });
      prompt.value = '';
      lastComposer = '';
    });
    $('stopButton').addEventListener('click', () => vscode.postMessage({ type: 'stop' }));
    $('logButton').addEventListener('click', () => vscode.postMessage({ type: 'openLog' }));
    $('toggleConfig').addEventListener('click', () => $('configForm').classList.toggle('open'));
    $('openCommandConfig').addEventListener('click', () => vscode.postMessage({ type: 'configure' }));
    $('configForm').addEventListener('submit', (event) => {
      event.preventDefault();
      vscode.postMessage({
        type: 'saveConfig',
        provider: $('configProvider').value,
        model: $('configModel').value,
        baseUrl: $('configBaseUrl').value,
        apiKey: $('configApiKey').value
      });
      $('configApiKey').value = '';
    });
    document.querySelectorAll('.mode-button').forEach((button) => {
      button.addEventListener('click', () => {
        activeMode = button.getAttribute('data-mode') || 'query';
        renderMode();
      });
    });
    $('contextFiles').addEventListener('click', (event) => {
      const file = event.target?.getAttribute?.('data-remove-file');
      if (!file || !state) return;
      state.contextFiles = state.contextFiles.filter((item) => item !== file);
      renderContext(state);
    });
    $('messages').addEventListener('click', (event) => {
      const approve = event.target?.getAttribute?.('data-approve');
      const reject = event.target?.getAttribute?.('data-reject');
      if (approve) vscode.postMessage({ type: 'approve', approvalId: approve });
      if (reject) vscode.postMessage({ type: 'reject', approvalId: reject });
    });
    detailsPanel.addEventListener('toggle', () => {
      vscode.postMessage({ type: 'details', collapsed: !detailsPanel.open });
    });

    window.addEventListener('message', (event) => {
      const message = event.data;
      if (message.type === 'state') render(message.state);
    });

    vscode.postMessage({ type: 'ready' });
  </script>
</body>
</html>`;
}
