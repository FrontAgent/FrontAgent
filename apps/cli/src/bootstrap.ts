/**
 * Shared CLI bootstrap utilities.
 * Lightweight helpers reused across multiple commands — kept free of
 * heavy imports (core, MCP, React) so that cheap subcommands like
 * `--help` and `info` never pay the import cost.
 */

import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentModuleDir = dirname(fileURLToPath(import.meta.url));

export function resolveBuiltInSkillRoots(): string[] {
  const candidates = [
    resolve(currentModuleDir, '..', 'skills'),
    resolve(currentModuleDir, '..', '..', 'skills'),
    resolve(currentModuleDir, '..', '..', '..', 'skills'),
  ];

  return [...new Set(candidates.filter((candidate) => existsSync(candidate)))];
}

export function getDefaultModel(provider: 'openai' | 'anthropic'): string {
  switch (provider) {
    case 'openai':
      return 'gpt-4-turbo';
    case 'anthropic':
      return 'claude-3-5-sonnet-20241022';
    default:
      return 'claude-3-5-sonnet-20241022';
  }
}

export function parseOptionalInt(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function parseOptionalFloat(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function resolveProviderApiKey(
  provider: 'openai' | 'anthropic',
  cliValue?: string,
): string | undefined {
  return cliValue ?? process.env[`${provider.toUpperCase()}_API_KEY`] ?? process.env.API_KEY;
}

export function resolveProviderBaseURL(
  provider: 'openai' | 'anthropic',
  cliValue?: string,
): string | undefined {
  return cliValue ?? process.env[`${provider.toUpperCase()}_BASE_URL`] ?? process.env.BASE_URL;
}

export function resolveEmbeddingBaseURL(baseURL?: string): string | undefined {
  if (!baseURL) return undefined;
  const normalized = baseURL.replace(/\/+$/, '');
  return normalized.endsWith('/embeddings') ? normalized : `${normalized}/embeddings`;
}

export function resolveLLMConfigFromOptions(options: {
  provider?: string;
  model?: string;
  baseUrl?: string;
  apiKey?: string;
  maxTokens?: string;
  temperature?: string;
  topP?: string;
  topK?: string;
}) {
  const provider = (options.provider || process.env.PROVIDER || 'anthropic').toLowerCase() as 'openai' | 'anthropic';
  const model = options.model || process.env.MODEL || getDefaultModel(provider);

  return {
    provider,
    model,
    baseURL: resolveProviderBaseURL(provider, options.baseUrl),
    apiKey: resolveProviderApiKey(provider, options.apiKey),
    maxTokens: parseOptionalInt(options.maxTokens) ?? 4096,
    temperature: parseOptionalFloat(options.temperature) ?? 0.2,
    topP: parseOptionalFloat(options.topP) ?? parseOptionalFloat(process.env.TOP_P),
    topK: parseOptionalInt(options.topK) ?? parseOptionalInt(process.env.TOP_K),
  } as const;
}

export function parsePathList(values: string[] | undefined, fallback?: string): string[] | undefined {
  if (values && values.length > 0) {
    return values.map((value) => value.trim()).filter(Boolean);
  }
  if (!fallback?.trim()) return undefined;
  return fallback
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

export function getDefaultRagCacheDir(cwd = process.cwd()): string {
  return resolve(cwd, '.frontagent', 'rag-cache');
}
