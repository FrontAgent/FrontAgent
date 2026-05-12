import type { ConfigStatus, MissingConfigField } from './state.js';

export interface ConfigSourceValues {
  settings: {
    provider?: string;
    model?: string;
    baseUrl?: string;
    apiKey?: string;
  };
  secrets: {
    providerApiKey?: string;
    legacyApiKey?: string;
  };
  env: Record<string, string | undefined>;
}

function emptyToUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeProvider(value: string | undefined): 'anthropic' | 'openai' | undefined {
  const normalized = emptyToUndefined(value)?.toLowerCase();
  return normalized === 'anthropic' || normalized === 'openai' ? normalized : undefined;
}

function providerEnvName(provider: string | undefined, name: string): string | undefined {
  return provider ? `${provider.toUpperCase()}_${name}` : undefined;
}

export function resolveConfigStatusFromSources(values: ConfigSourceValues): ConfigStatus {
  const provider = normalizeProvider(values.settings.provider ?? values.env.PROVIDER);
  const providerBaseUrlEnv = providerEnvName(provider, 'BASE_URL');
  const providerApiKeyEnv = providerEnvName(provider, 'API_KEY');
  const model = emptyToUndefined(values.settings.model) ?? emptyToUndefined(values.env.MODEL) ?? null;
  const baseUrl =
    emptyToUndefined(values.settings.baseUrl) ??
    (providerBaseUrlEnv ? emptyToUndefined(values.env[providerBaseUrlEnv]) : undefined) ??
    emptyToUndefined(values.env.BASE_URL) ??
    null;
  const apiKey =
    emptyToUndefined(values.secrets.providerApiKey) ??
    emptyToUndefined(values.secrets.legacyApiKey) ??
    emptyToUndefined(values.settings.apiKey) ??
    (providerApiKeyEnv ? emptyToUndefined(values.env[providerApiKeyEnv]) : undefined) ??
    emptyToUndefined(values.env.API_KEY);

  const missing: MissingConfigField[] = [];
  if (!provider) missing.push('provider');
  if (!model) missing.push('model');
  if (!baseUrl) missing.push('baseUrl');
  if (!apiKey) missing.push('apiKey');

  return {
    provider: provider ?? null,
    model,
    baseUrl,
    hasApiKey: Boolean(apiKey),
    configured: missing.length === 0,
    missing,
  };
}
