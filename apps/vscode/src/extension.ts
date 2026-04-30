import * as vscode from 'vscode';
import {
  initSddConfig,
  runFrontAgentTask,
  validateSddConfig,
  type ApprovalRequest,
  type RuntimeConfigInput,
} from '@frontagent/runtime-node';
import {
  createInitialViewState,
  reduceAgentEvent,
  type ViewApproval,
  type ViewState,
} from './state.js';

const VIEW_ID = 'frontagent.taskView';
const SECRET_API_KEY = 'frontagent.apiKey';

type WebviewMessage =
  | { type: 'ready' }
  | { type: 'run'; task: string; taskType: string; files: string[]; url?: string }
  | { type: 'cancel' }
  | { type: 'approve'; approvalId: string }
  | { type: 'reject'; approvalId: string }
  | { type: 'openLog' }
  | { type: 'configure' };

interface PendingApproval {
  approvalId: string;
  resolve: (approved: boolean) => void;
}

interface PrefillRequest {
  task?: string;
  taskType?: string;
  files?: string[];
  url?: string;
  autoRun?: boolean;
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
      const task = await vscode.window.showInputBox({
        title: 'FrontAgent task',
        prompt: 'Describe what FrontAgent should do with the current file.',
        value: `Analyze ${vscode.workspace.asRelativePath(editor.document.uri)}`,
      });
      if (!task) return;
      await revealFrontAgentView();
      provider.prefill({
        task,
        files: [vscode.workspace.asRelativePath(editor.document.uri)],
        autoRun: true,
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
      const task = await vscode.window.showInputBox({
        title: 'FrontAgent task',
        prompt: 'Edit the selected text into a task for FrontAgent.',
        value: selection.length > 1200 ? selection.slice(0, 1200) : selection,
      });
      if (!task) return;
      await revealFrontAgentView();
      provider.prefill({
        task,
        files: [vscode.workspace.asRelativePath(editor.document.uri)],
        autoRun: true,
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
      provider.postConfigurationStatus();
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
    this.view?.webview.postMessage({ type: 'prefill', ...request });
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

  postConfigurationStatus(): void {
    this.post({ type: 'configuration', configured: true });
  }

  private async handleMessage(message: WebviewMessage): Promise<void> {
    switch (message.type) {
      case 'ready':
        this.postState();
        if (this.pendingPrefill) {
          this.view?.webview.postMessage({ type: 'prefill', ...this.pendingPrefill });
        }
        break;
      case 'run':
        await this.startRun(message);
        break;
      case 'cancel':
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
    }
  }

  private async startRun(message: Extract<WebviewMessage, { type: 'run' }>): Promise<void> {
    if (this.activeRun) {
      vscode.window.showWarningMessage('FrontAgent is already running in this workspace.');
      return;
    }

    const folder = getWorkspaceFolder();
    if (!folder) {
      this.setError('Open a workspace folder before running FrontAgent.');
      return;
    }

    const task = message.task.trim();
    if (!task) {
      this.setError('Task is required.');
      return;
    }

    const controller = new AbortController();
    this.activeRun = controller;
    this.pendingApproval = undefined;
    this.state = {
      ...createInitialViewState(),
      status: 'scanning',
      isRunning: true,
      taskDescription: task,
      lastActivityLabel: '准备运行',
    };
    this.postState();

    const runtimeOptions = await resolveRuntimeOptions(this.context, folder);

    void runFrontAgentTask({
      ...runtimeOptions,
      projectRoot: folder.uri.fsPath,
      task,
      type: message.taskType,
      files: message.files,
      url: message.url,
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
      this.state = {
        ...this.state,
        status: result.success ? 'done' : 'error',
        isRunning: false,
        approval: null,
        result,
        error: result.error ?? null,
        lastActivityLabel: result.success ? '任务完成' : '任务失败',
        currentOperation: null,
      };
      this.postState();
    }).catch((error) => {
      this.setError(error instanceof Error ? error.message : String(error));
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

  private setError(error: string): void {
    this.state = {
      ...this.state,
      status: 'error',
      isRunning: false,
      error,
      lastActivityLabel: '任务失败',
      currentOperation: null,
    };
    this.postState();
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
    // Older Extension Host builds may not expose the generated focus command immediately.
  }
}

function getWorkspaceFolder(): vscode.WorkspaceFolder | undefined {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    vscode.window.showWarningMessage('Open a workspace folder before using FrontAgent.');
  }
  return folder;
}

async function resolveRuntimeOptions(
  context: vscode.ExtensionContext,
  folder: vscode.WorkspaceFolder,
): Promise<RuntimeConfigInput & { debug?: boolean }> {
  const config = vscode.workspace.getConfiguration('frontagent', folder.uri);
  const provider = config.get<string>('provider', 'anthropic');
  const apiKey =
    await context.secrets.get(`${SECRET_API_KEY}.${provider}`) ??
    await context.secrets.get(SECRET_API_KEY);

  return {
    provider,
    model: emptyToUndefined(config.get<string>('model')),
    baseUrl: emptyToUndefined(config.get<string>('baseUrl')),
    apiKey,
    maxTokens: config.get<number>('maxTokens', 4096),
    temperature: config.get<number>('temperature', 0.7),
    securityMode: config.get<string>('securityMode', 'balanced'),
    disableRag: !config.get<boolean>('rag.enabled', true),
    ragRepo: config.get<string>('rag.repo', 'https://github.com/ceilf6/Lab.git'),
    ragBranch: config.get<string>('rag.branch', 'main'),
  };
}

function emptyToUndefined(value: string | undefined): string | undefined {
  return value?.trim() ? value.trim() : undefined;
}

async function configureFrontAgent(context: vscode.ExtensionContext): Promise<void> {
  const config = vscode.workspace.getConfiguration('frontagent');
  const provider = await vscode.window.showQuickPick(['anthropic', 'openai'], {
    title: 'FrontAgent provider',
    placeHolder: 'Choose LLM provider',
  });
  if (!provider) return;
  await config.update('provider', provider, vscode.ConfigurationTarget.Workspace);

  const model = await vscode.window.showInputBox({
    title: 'FrontAgent model',
    prompt: 'Leave empty to use the FrontAgent default for this provider.',
    value: config.get<string>('model', ''),
  });
  if (model !== undefined) {
    await config.update('model', model.trim(), vscode.ConfigurationTarget.Workspace);
  }

  const baseUrl = await vscode.window.showInputBox({
    title: 'FrontAgent base URL',
    prompt: 'Optional API base URL.',
    value: config.get<string>('baseUrl', ''),
  });
  if (baseUrl !== undefined) {
    await config.update('baseUrl', baseUrl.trim(), vscode.ConfigurationTarget.Workspace);
  }

  const apiKey = await vscode.window.showInputBox({
    title: 'FrontAgent API key',
    prompt: 'Stored in VSCode SecretStorage.',
    password: true,
    ignoreFocusOut: true,
  });
  if (apiKey) {
    await context.secrets.store(`${SECRET_API_KEY}.${provider}`, apiKey);
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
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 12px;
      color: var(--vscode-foreground);
      background: var(--surface);
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
    }
    .shell { display: grid; gap: 14px; }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      border-bottom: 1px solid var(--border);
      padding-bottom: 10px;
    }
    .title { font-weight: 700; letter-spacing: 0; }
    .status { color: var(--muted); font-size: 12px; white-space: nowrap; }
    form { display: grid; gap: var(--gap); }
    textarea, input, select {
      width: 100%;
      color: var(--vscode-input-foreground);
      background: var(--field);
      border: 1px solid var(--field-border, var(--border));
      border-radius: var(--radius);
      padding: 7px 8px;
      font: inherit;
    }
    textarea { min-height: 92px; resize: vertical; line-height: 1.45; }
    label { display: grid; gap: 5px; color: var(--muted); font-size: 12px; }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: var(--gap); }
    .actions { display: grid; grid-template-columns: 1fr auto auto; gap: 8px; align-items: center; }
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
    .section { display: grid; gap: 8px; }
    .section-title {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      color: var(--muted);
      font-size: 12px;
      text-transform: uppercase;
    }
    .activity {
      border-left: 2px solid var(--accent);
      padding: 6px 8px;
      background: color-mix(in srgb, var(--vscode-editor-background) 70%, transparent);
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
      background: var(--vscode-editor-background);
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
      max-height: 220px;
      overflow: auto;
      white-space: pre-wrap;
      background: var(--vscode-editor-background);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 8px;
    }
    .approval {
      border: 1px solid var(--vscode-editorWarning-foreground);
      border-radius: var(--radius);
      padding: 9px;
      display: grid;
      gap: 8px;
    }
    .approval-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .error { color: var(--danger); }
    .muted { color: var(--muted); }
    .empty { color: var(--muted); padding: 8px 0; }
  </style>
</head>
<body>
  <div class="shell">
    <div class="header">
      <div class="title">FrontAgent</div>
      <div id="status" class="status">Idle</div>
    </div>

    <form id="taskForm">
      <label>Task
        <textarea id="task" placeholder="Describe the change, investigation, or question..."></textarea>
      </label>
      <div class="row">
        <label>Type
          <select id="taskType">
            <option value="query">query</option>
            <option value="modify">modify</option>
            <option value="create">create</option>
            <option value="debug">debug</option>
            <option value="refactor">refactor</option>
            <option value="test">test</option>
          </select>
        </label>
        <label>Browser URL
          <input id="url" placeholder="http://localhost:5173">
        </label>
      </div>
      <label>Relevant files
        <input id="files" placeholder="src/App.tsx, src/components/Button.tsx">
      </label>
      <div class="actions">
        <button id="runButton" type="submit">Run</button>
        <button id="cancelButton" class="secondary" type="button">Cancel</button>
        <button id="configButton" class="secondary" type="button">Config</button>
      </div>
    </form>

    <div id="approval"></div>

    <div class="section">
      <div class="section-title"><span>Activity</span><button id="logButton" class="secondary" type="button">Log</button></div>
      <div class="activity">
        <div id="activityLabel">等待开始</div>
        <div id="operation" class="muted"></div>
      </div>
    </div>

    <div class="section">
      <div class="section-title"><span>Plan</span><span id="phaseCount"></span></div>
      <div id="phases" class="empty">No plan yet.</div>
    </div>

    <div class="section">
      <div class="section-title"><span>Knowledge</span><span id="ragMeta"></span></div>
      <div id="rag" class="empty">No matches yet.</div>
    </div>

    <div class="section">
      <div class="section-title"><span>Stream</span></div>
      <pre id="stream"></pre>
    </div>

    <div class="section">
      <div class="section-title"><span>Result</span></div>
      <pre id="result"></pre>
    </div>
  </div>

  <script nonce="${scriptNonce}">
    const vscode = acquireVsCodeApi();
    let state = null;
    const $ = (id) => document.getElementById(id);
    const task = $('task');
    const taskType = $('taskType');
    const files = $('files');
    const url = $('url');

    function splitFiles(value) {
      return value.split(/[,\n]/).map((item) => item.trim()).filter(Boolean);
    }

    function render(next) {
      state = next;
      $('status').textContent = next.status;
      $('runButton').disabled = next.isRunning;
      $('cancelButton').disabled = !next.isRunning;
      $('activityLabel').textContent = next.lastActivityLabel || '等待开始';
      $('operation').textContent = next.currentOperation || '';
      $('phaseCount').textContent = next.phases.length ? String(next.phases.length) : '';

      $('approval').innerHTML = next.approval ? \`
        <div class="approval">
          <strong>Approval required</strong>
          <div class="muted">\${escapeHtml(next.approval.riskLevel)} · \${escapeHtml(next.approval.reasonCode)}</div>
          <div>\${escapeHtml(next.approval.message)}</div>
          <pre>\${escapeHtml(next.approval.argsSummary)}</pre>
          <div class="approval-actions">
            <button data-approve="\${next.approval.approvalId}">Approve</button>
            <button class="secondary" data-reject="\${next.approval.approvalId}">Reject</button>
          </div>
        </div>\` : '';

      $('phases').className = next.phases.length ? '' : 'empty';
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
                  \${step.error ? \`<div class="error">\${escapeHtml(step.error)}</div>\` : ''}
                </div>
              </div>\`).join('')}
          </div>
        </div>\`).join('') : 'No plan yet.';

      $('ragMeta').textContent = next.ragSearchMode ? \`\${next.ragSearchMode}\${next.ragReranked ? ' · reranked' : ''}\` : '';
      $('rag').className = next.ragMatches.length ? '' : 'empty';
      $('rag').innerHTML = next.ragMatches.length
        ? next.ragMatches.map((match) => \`<div><strong>\${escapeHtml(match.title)}</strong><div class="muted mono">\${escapeHtml(match.path || '')}</div></div>\`).join('')
        : 'No matches yet.';
      $('stream').textContent = next.streamText || '';
      $('result').textContent = next.result?.output || next.error || '';
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

    $('taskForm').addEventListener('submit', (event) => {
      event.preventDefault();
      vscode.postMessage({
        type: 'run',
        task: task.value,
        taskType: taskType.value,
        files: splitFiles(files.value),
        url: url.value.trim() || undefined
      });
    });
    $('cancelButton').addEventListener('click', () => vscode.postMessage({ type: 'cancel' }));
    $('logButton').addEventListener('click', () => vscode.postMessage({ type: 'openLog' }));
    $('configButton').addEventListener('click', () => vscode.postMessage({ type: 'configure' }));
    $('approval').addEventListener('click', (event) => {
      const target = event.target;
      const approve = target?.getAttribute?.('data-approve');
      const reject = target?.getAttribute?.('data-reject');
      if (approve) vscode.postMessage({ type: 'approve', approvalId: approve });
      if (reject) vscode.postMessage({ type: 'reject', approvalId: reject });
    });

    window.addEventListener('message', (event) => {
      const message = event.data;
      if (message.type === 'state') render(message.state);
      if (message.type === 'prefill') {
        if (message.task !== undefined) task.value = message.task;
        if (message.taskType !== undefined) taskType.value = message.taskType;
        if (message.files !== undefined) files.value = message.files.join(', ');
        if (message.url !== undefined) url.value = message.url;
        if (message.autoRun) $('taskForm').requestSubmit();
      }
    });

    vscode.postMessage({ type: 'ready' });
  </script>
</body>
</html>`;
}
