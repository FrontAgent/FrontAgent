import { createHash } from 'node:crypto';

export function normalizeRepoPath(path: string): string {
  return path
    .replace(/\\/g, '/')
    .replace(/^\.?\//, '')
    .replace(/^\/+/, '');
}

export function normalizeBaseUrl(baseURL: string): string {
  return baseURL.replace(/\/+$/, '');
}

export function normalizeOptionalBaseUrl(baseURL: string | undefined): string | undefined {
  if (!baseURL?.trim()) {
    return undefined;
  }
  return normalizeBaseUrl(baseURL.trim());
}

export function normalizeEmbeddingBaseUrl(baseURL: string): string {
  const normalized = normalizeBaseUrl(baseURL);
  return normalized.endsWith('/embeddings') ? normalized : `${normalized}/embeddings`;
}

export function normalizeRerankerBaseUrl(baseURL: string): string {
  const normalized = normalizeBaseUrl(baseURL);
  return normalized.endsWith('/rerank') ? normalized : `${normalized}/rerank`;
}

export function toBlobUrl(repoUrl: string, branch: string, path: string): string {
  const repoBase = repoUrl.replace(/\.git$/, '');
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  return `${repoBase}/blob/${encodeURIComponent(branch)}/${encodedPath}`;
}

export function hashText(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export function getTopLevelDir(path: string): string {
  const firstSegment = normalizeRepoPath(path).split('/')[0];
  return firstSegment || 'root';
}

export function parseOptionalInt(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function parseOptionalBoolean(value: string | undefined): boolean | undefined {
  if (!value) {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on') {
    return true;
  }
  if (normalized === '0' || normalized === 'false' || normalized === 'no' || normalized === 'off') {
    return false;
  }
  return undefined;
}

export function parseStringList(value: string | undefined): string[] | undefined {
  if (!value?.trim()) {
    return undefined;
  }
  const items = value
    .split(',')
    .map((item) => normalizeRepoPath(item.trim()))
    .filter(Boolean);
  return items.length > 0 ? items : undefined;
}

export function sameStringSet(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  const normalizedLeft = [...left].sort();
  const normalizedRight = [...right].sort();
  return normalizedLeft.every((value, index) => value === normalizedRight[index]);
}

export async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export function getString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

export function getNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
