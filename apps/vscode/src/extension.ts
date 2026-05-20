import * as vscode from 'vscode';
import { configureFrontAgent, getWorkspaceFolder } from './settings-resolve.js';
import { FrontAgentViewProvider } from './view-provider.js';

const VIEW_ID = 'frontagent.taskView';

let outputChannel: vscode.OutputChannel | undefined;

export function activate(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel('FrontAgent');
  context.subscriptions.push(outputChannel);
  log('Activating FrontAgent extension.');
  log(`Extension path: ${context.extensionPath}`);
  log(`Extension mode: ${String(context.extensionMode)}`);

  try {
    const provider = new FrontAgentViewProvider(context, log, logError);
    context.subscriptions.push(
      vscode.window.registerWebviewViewProvider(VIEW_ID, provider, {
        webviewOptions: { retainContextWhenHidden: true },
      }),
      registerFrontAgentCommand('frontagent.run', async () => {
        await revealFrontAgentView();
        provider.prefill({});
      }),
      registerFrontAgentCommand('frontagent.runCurrentFile', async () => {
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
      registerFrontAgentCommand('frontagent.runSelection', async () => {
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
      registerFrontAgentCommand('frontagent.initSdd', async () => {
        const folder = getWorkspaceFolder();
        if (!folder) return;
        const { initSddConfig } = await import('@frontagent/runtime-node');
        const result = initSddConfig(folder.uri.fsPath);
        if (result.created) {
          vscode.window.showInformationMessage(result.message);
          const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(result.path));
          await vscode.window.showTextDocument(doc);
        } else {
          vscode.window.showWarningMessage(result.message);
        }
      }),
      registerFrontAgentCommand('frontagent.validateSdd', async () => {
        const folder = getWorkspaceFolder();
        if (!folder) return;
        const { validateSddConfig } = await import('@frontagent/runtime-node');
        const result = validateSddConfig(folder.uri.fsPath);
        if (result.success) {
          vscode.window.showInformationMessage(
            `SDD valid: ${result.projectName ?? '(unknown)'} · ${result.framework ?? ''} ${result.frameworkVersion ?? ''}`.trim(),
          );
        } else {
          vscode.window.showErrorMessage(`SDD invalid: ${(result.errors ?? []).join('; ')}`);
        }
      }),
      registerFrontAgentCommand('frontagent.openRunLog', async () => {
        await provider.openRunLog();
      }),
      registerFrontAgentCommand('frontagent.showLogs', () => {
        outputChannel?.show(true);
      }),
      registerFrontAgentCommand('frontagent.configure', async () => {
        await configureFrontAgent(context);
        await provider.refreshConfigurationStatus();
      }),
    );
    log(
      'Activation complete. Registered commands: frontagent.run, frontagent.configure, frontagent.runCurrentFile, frontagent.runSelection, frontagent.initSdd, frontagent.validateSdd, frontagent.openRunLog, frontagent.showLogs.',
    );
  } catch (error) {
    logError('Activation failed.', error);
    vscode.window.showErrorMessage(`FrontAgent activation failed: ${formatError(error)}`);
    throw error;
  }
}

export function deactivate() {
  log('Deactivating FrontAgent extension.');
}

function registerFrontAgentCommand(
  command: string,
  handler: (...args: unknown[]) => unknown | Promise<unknown>,
): vscode.Disposable {
  return vscode.commands.registerCommand(command, async (...args: unknown[]) => {
    log(`Command invoked: ${command}`);
    try {
      const result = await handler(...args);
      log(`Command completed: ${command}`);
      return result;
    } catch (error) {
      logError(`Command failed: ${command}`, error);
      vscode.window.showErrorMessage(`FrontAgent command failed: ${formatError(error)}`);
      throw error;
    }
  });
}

async function revealFrontAgentView(): Promise<void> {
  await vscode.commands.executeCommand('workbench.view.extension.frontagent');
  try {
    await vscode.commands.executeCommand(`${VIEW_ID}.focus`);
  } catch {
    // Some Extension Host builds expose the generated focus command after the view is resolved.
  }
}

function log(message: string): void {
  outputChannel?.appendLine(`[${new Date().toISOString()}] ${message}`);
}

function logError(message: string, error: unknown): void {
  outputChannel?.appendLine(`[${new Date().toISOString()}] ERROR ${message}`);
  outputChannel?.appendLine(formatError(error));
  if (error instanceof Error && error.stack) {
    outputChannel?.appendLine(error.stack);
  }
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
