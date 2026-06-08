import type { RuntimeConfigInput } from '@frontagent/runtime-node';
import * as vscode from 'vscode';
import { resolveConfigStatusFromSources } from './settings.js';
import type { ConfigStatus } from './state.js';

export const SECRET_API_KEY = 'frontagent.apiKey';

export function emptyToUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function normalizeFiles(files: string[]): string[] {
  return [...new Set(files.map((file) => file.trim()).filter(Boolean))];
}

export function getWorkspaceFolder(): vscode.WorkspaceFolder | undefined {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    vscode.window.showWarningMessage('Open a workspace folder before using FrontAgent.');
  }
  return folder;
}

export async function resolveConfigurationStatus(
  context: vscode.ExtensionContext,
  folder?: vscode.WorkspaceFolder,
): Promise<ConfigStatus> {
  const config = vscode.workspace.getConfiguration('frontagent', folder?.uri);
  const provider = emptyToUndefined(config.get<string>('provider'));
  const envProvider = emptyToUndefined(process.env.PROVIDER)?.toLowerCase();
  const providerForSecret =
    provider ?? (envProvider === 'openai' || envProvider === 'anthropic' ? envProvider : undefined);
  const providerApiKey = providerForSecret
    ? await context.secrets.get(`${SECRET_API_KEY}.${providerForSecret}`)
    : undefined;
  const legacyApiKey = await context.secrets.get(SECRET_API_KEY);
  const settingsApiKey = emptyToUndefined(config.get<string>('apiKey'));
  return resolveConfigStatusFromSources({
    settings: {
      provider,
      model: emptyToUndefined(config.get<string>('model')),
      baseUrl: emptyToUndefined(config.get<string>('baseUrl')),
      apiKey: settingsApiKey,
    },
    secrets: {
      providerApiKey,
      legacyApiKey,
    },
    env: process.env,
  });
}

export async function resolveRuntimeOptions(
  context: vscode.ExtensionContext,
  folder: vscode.WorkspaceFolder,
  status: ConfigStatus,
): Promise<RuntimeConfigInput & { debug?: boolean }> {
  const config = vscode.workspace.getConfiguration('frontagent', folder.uri);
  const providerApiKey = status.provider
    ? await context.secrets.get(`${SECRET_API_KEY}.${status.provider}`)
    : undefined;
  const legacyApiKey = await context.secrets.get(SECRET_API_KEY);
  const settingsApiKey = emptyToUndefined(config.get<string>('apiKey'));
  const providerEnvApiKey = status.provider
    ? process.env[`${status.provider.toUpperCase()}_API_KEY`]
    : undefined;
  return {
    provider: status.provider ?? undefined,
    model: status.model ?? undefined,
    baseUrl: status.baseUrl ?? undefined,
    apiKey:
      providerApiKey ?? legacyApiKey ?? settingsApiKey ?? providerEnvApiKey ?? process.env.API_KEY,
    maxTokens: config.get<number>('maxTokens', 4096),
    temperature: config.get<number>('temperature', 0.7),
    securityMode: config.get<string>('securityMode', 'balanced'),
    disableRag: !config.get<boolean>('rag.enabled', true),
    ragRepo: config.get<string>('rag.repo', 'https://github.com/ceilf6/Lab.git'),
    ragBranch: config.get<string>('rag.branch', 'main'),
  };
}

export async function configureFrontAgent(context: vscode.ExtensionContext): Promise<void> {
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
    prompt:
      'OpenAI-compatible or Anthropic-compatible base URL, for example https://api.siliconflow.cn/v1.',
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
