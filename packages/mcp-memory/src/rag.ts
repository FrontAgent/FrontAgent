import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const DEFAULT_MAX_RESULTS = 5;
const DEFAULT_ENTRY_HYDRATION_LIMIT = 3;
const SEED_FETCH_TIMEOUT_MS = 20000;
const ENTRY_FETCH_TIMEOUT_MS = 8000;
const DEFAULT_EXCLUDED_PATH_PREFIXES = [
  'AI/3-Application/FrontAgent-app',
];

export interface KnowledgeBaseConfig {
  repoUrl: string;
  branch: string;
  seedPath: string;
  cacheDir: string;
  syncOnQuery?: boolean;
}

export interface RagQueryParams {
  query: string;
  maxResults?: number;
  refresh?: boolean;
}

export interface RagQueryMatch {
  id: string;
  type: KnowledgeNodeType;
  title: string;
  sourceUrl: string;
  snippet: string;
  score: number;
  path?: string;
}

export interface RagQueryResult {
  success: boolean;
  syncedAt?: string;
  sourceRevision?: string;
  results?: RagQueryMatch[];
  error?: string;
}

type KnowledgeNodeType = 'readme' | 'file' | 'commit' | 'issue' | 'discussion' | 'external';

interface KnowledgeIndex {
  version: 2;
  source: {
    repoUrl: string;
    branch: string;
    seedPath: string;
    seedUrl: string;
    remoteRevision: string;
    syncedAt: string;
  };
  entries: KnowledgeEntry[];
}

interface KnowledgeEntry {
  id: string;
  type: KnowledgeNodeType;
  title: string;
  sourceUrl: string;
  path?: string;
  annotations: string[];
  body: string;
  fetchUrl?: string;
  cacheKey?: string;
  hydratedAt?: string;
  hydrateError?: string;
}

interface SeedLink {
  title: string;
  href: string;
  annotations: string[];
}

interface ResolvedLink {
  type: KnowledgeNodeType;
  sourceUrl: string;
  fetchUrl?: string;
  path?: string;
  commitSha?: string;
}

interface QueryScoredMatch {
  entry: KnowledgeEntry;
  score: number;
}

interface RemoteTextDocument {
  text: string;
  revision: string;
}

export function createKnowledgeBase(config: KnowledgeBaseConfig) {
  return new ReadmeSeedKnowledgeBase(config);
}

export async function ragQuery(
  params: RagQueryParams,
  config: KnowledgeBaseConfig
): Promise<RagQueryResult> {
  const knowledgeBase = createKnowledgeBase(config);
  return knowledgeBase.query(params);
}

export const ragQuerySchema = {
  name: 'rag_query',
  description: 'Query a remote knowledge base seeded by a README and lazily fetch linked documents.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: 'Natural-language query for the knowledge base',
      },
      maxResults: {
        type: 'number',
        description: 'Maximum number of matches to return',
        default: DEFAULT_MAX_RESULTS,
      },
      refresh: {
        type: 'boolean',
        description: 'Force a README refresh before querying',
        default: false,
      },
    },
    required: ['query'],
  },
};

class ReadmeSeedKnowledgeBase {
  private readonly config: KnowledgeBaseConfig;

  constructor(config: KnowledgeBaseConfig) {
    this.config = {
      ...config,
      cacheDir: resolve(config.cacheDir),
    };
  }

  async query(params: RagQueryParams): Promise<RagQueryResult> {
    if (!params.query?.trim()) {
      return {
        success: false,
        error: 'query is required',
      };
    }

    try {
      const index = await this.ensureIndex(Boolean(params.refresh));
      const query = params.query.trim();
      const maxResults = params.maxResults ?? DEFAULT_MAX_RESULTS;
      const initialMatches = this.search(
        index.entries,
        query,
        Math.max(maxResults, DEFAULT_ENTRY_HYDRATION_LIMIT),
      );

      const hydrationResults = await Promise.all(
        initialMatches.map((match) => this.hydrateEntry(match.entry))
      );
      const indexChanged = hydrationResults.some(Boolean);

      if (indexChanged) {
        this.writeIndex(index);
      }

      const reranked = this.search(index.entries, query, maxResults);

      return {
        success: true,
        syncedAt: index.source.syncedAt,
        sourceRevision: index.source.remoteRevision,
        results: reranked.map(({ entry, score }) => ({
          id: entry.id,
          type: entry.type,
          title: entry.title,
          sourceUrl: entry.sourceUrl,
          path: entry.path,
          score,
          snippet: buildSnippet(entry, query),
        })),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async ensureIndex(forceRefresh: boolean): Promise<KnowledgeIndex> {
    mkdirSync(this.config.cacheDir, { recursive: true });

    const existing = this.readIndex();
    if (!forceRefresh && existing) {
      return existing;
    }

    const seedDocument = await this.fetchSeedDocument();
    if (existing && existing.source.remoteRevision === seedDocument.revision) {
      return existing;
    }

    const index = this.buildIndex(seedDocument);
    this.writeIndex(index);
    return index;
  }

  private readIndex(): KnowledgeIndex | null {
    const indexPath = this.getIndexPath();
    if (!existsSync(indexPath)) {
      return null;
    }

    try {
      const parsed = JSON.parse(readFileSync(indexPath, 'utf-8')) as KnowledgeIndex;
      if (parsed.version !== 2) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  private writeIndex(index: KnowledgeIndex): void {
    writeFileSync(this.getIndexPath(), JSON.stringify(index, null, 2), 'utf-8');
  }

  private buildIndex(seedDocument: RemoteTextDocument): KnowledgeIndex {
    const seedUrl = toRawUrl(this.config.repoUrl, this.config.branch, this.config.seedPath);
    const entries = new Map<string, KnowledgeEntry>();

    entries.set('readme:root', {
      id: 'readme:root',
      type: 'readme',
      title: this.config.seedPath,
      sourceUrl: toBlobUrl(this.config.repoUrl, this.config.branch, this.config.seedPath),
      fetchUrl: seedUrl,
      cacheKey: 'seed-readme',
      path: this.config.seedPath,
      annotations: ['Seed README index for the knowledge base.'],
      body: truncate(seedDocument.text, 20000),
      hydratedAt: new Date().toISOString(),
    });

    const seedLinks = parseSeedLinks(seedDocument.text);
    for (const seedLink of seedLinks) {
      const resolved = resolveSeedLink(seedLink.href, this.config.repoUrl, this.config.branch);
      if (!resolved) {
        continue;
      }

      if (resolved.path && isExcludedKnowledgePath(resolved.path)) {
        continue;
      }

      const entry = this.buildSeedEntry(resolved, seedLink);
      const existing = entries.get(entry.id);
      if (existing) {
        existing.annotations.push(...entry.annotations);
        continue;
      }
      entries.set(entry.id, entry);
    }

    return {
      version: 2,
      source: {
        repoUrl: this.config.repoUrl,
        branch: this.config.branch,
        seedPath: this.config.seedPath,
        seedUrl,
        remoteRevision: seedDocument.revision,
        syncedAt: new Date().toISOString(),
      },
      entries: Array.from(entries.values()),
    };
  }

  private buildSeedEntry(resolved: ResolvedLink, seedLink: SeedLink): KnowledgeEntry {
    return {
      id: buildEntryId(resolved),
      type: resolved.type,
      title: seedLink.title,
      sourceUrl: resolved.sourceUrl,
      fetchUrl: resolved.fetchUrl,
      cacheKey: buildCacheKey(resolved),
      path: resolved.path,
      annotations: seedLink.annotations,
      body: [
        resolved.path ? `path=${resolved.path}` : '',
        resolved.commitSha ? `commit=${resolved.commitSha}` : '',
        seedLink.annotations.join('\n'),
      ].filter(Boolean).join('\n'),
    };
  }

  private async fetchSeedDocument(): Promise<RemoteTextDocument> {
    const seedUrl = toRawUrl(this.config.repoUrl, this.config.branch, this.config.seedPath);
    return fetchTextDocument(seedUrl, SEED_FETCH_TIMEOUT_MS);
  }

  private async hydrateEntry(entry: KnowledgeEntry): Promise<boolean> {
    if (!entry.fetchUrl || entry.hydratedAt) {
      return false;
    }

    const cachePath = this.getDocumentCachePath(entry);
    if (existsSync(cachePath)) {
      entry.body = readFileSync(cachePath, 'utf-8');
      entry.hydratedAt = new Date().toISOString();
      return true;
    }

    try {
      const text = await fetchEntryDocument(entry);
      if (!text) {
        entry.hydratedAt = new Date().toISOString();
        entry.hydrateError = 'Empty document response';
        return true;
      }

      mkdirSync(this.getDocumentsDir(), { recursive: true });
      writeFileSync(cachePath, text, 'utf-8');
      entry.body = text;
      entry.hydratedAt = new Date().toISOString();
      entry.hydrateError = undefined;
      return true;
    } catch (error) {
      entry.hydratedAt = new Date().toISOString();
      entry.hydrateError = error instanceof Error ? error.message : String(error);
      return true;
    }
  }

  private search(entries: KnowledgeEntry[], query: string, maxResults: number): QueryScoredMatch[] {
    const queryTokens = tokenize(query);
    const scored: QueryScoredMatch[] = [];

    for (const entry of entries) {
      const score = scoreEntry(entry, query, queryTokens);
      if (score <= 0) {
        continue;
      }
      scored.push({ entry, score });
    }

    scored.sort((left, right) => right.score - left.score);
    return scored.slice(0, maxResults);
  }

  private getIndexPath(): string {
    return join(this.config.cacheDir, 'index.json');
  }

  private getDocumentsDir(): string {
    return join(this.config.cacheDir, 'documents');
  }

  private getDocumentCachePath(entry: KnowledgeEntry): string {
    return join(this.getDocumentsDir(), `${entry.cacheKey ?? safeHash(entry.id)}.txt`);
  }
}

async function fetchEntryDocument(entry: KnowledgeEntry): Promise<string> {
  if (!entry.fetchUrl) {
    return '';
  }

  if ((entry.type === 'file' || entry.type === 'readme') && entry.path && !isTextLikePath(entry.path)) {
    return `Binary or non-text document: ${entry.sourceUrl}`;
  }

  const document = await fetchTextDocument(entry.fetchUrl, ENTRY_FETCH_TIMEOUT_MS);

  if (entry.type === 'issue' || entry.type === 'discussion' || entry.type === 'external') {
    return truncate(extractHtmlText(document.text, entry.sourceUrl), 12000);
  }

  return truncate(document.text, entry.type === 'commit' ? 12000 : 16000);
}

async function fetchTextDocument(url: string, timeoutMs: number): Promise<RemoteTextDocument> {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'FrontAgent/0.1',
      'accept': 'text/plain, text/html;q=0.9, */*;q=0.8',
    },
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  const text = await response.text();
  const revisionHeader = response.headers.get('etag') ?? response.headers.get('last-modified');
  return {
    text,
    revision: normalizeRevision(revisionHeader, text),
  };
}

function parseSeedLinks(markdown: string): SeedLink[] {
  const lines = markdown.split(/\r?\n/);
  const links: SeedLink[] = [];
  let current: SeedLink | null = null;
  let currentIndent = 0;

  for (const line of lines) {
    const bulletMatch = /^(\s*)-\s+(.*)$/.exec(line);
    if (!bulletMatch) {
      if (current && line.trim() && /^\s+/.test(line)) {
        current.annotations.push(stripMarkdown(line.trim()));
      }
      continue;
    }

    const indent = bulletMatch[1].length;
    const content = bulletMatch[2].trim();

    if (current && indent > currentIndent) {
      current.annotations.push(stripMarkdown(content));
      continue;
    }

    const parsed = extractPrimaryLink(content);
    if (!parsed) {
      current = null;
      currentIndent = indent;
      continue;
    }

    current = {
      title: parsed.title,
      href: parsed.href,
      annotations: parsed.annotation ? [parsed.annotation] : [],
    };
    currentIndent = indent;
    links.push(current);
  }

  return links;
}

function extractPrimaryLink(content: string): { title: string; href: string; annotation?: string } | null {
  const linkFirst = /^\[([^\]]+)\]\(([^)]+)\)(.*)$/.exec(content);
  if (linkFirst) {
    const annotation = stripMarkdown(linkFirst[3].trim());
    return {
      title: stripMarkdown(linkFirst[1].trim()),
      href: linkFirst[2].trim(),
      annotation: annotation || undefined,
    };
  }

  const allLinks = Array.from(content.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g));
  if (allLinks.length === 0) {
    return null;
  }

  const lastLink = allLinks[allLinks.length - 1];
  const titleText = stripMarkdown(content.replace(lastLink[0], '').trim());
  return {
    title: titleText || stripMarkdown(lastLink[1].trim()),
    href: lastLink[2].trim(),
  };
}

function resolveSeedLink(href: string, repoUrl: string, branch: string): ResolvedLink | null {
  if (!href) {
    return null;
  }

  if (!href.startsWith('http://') && !href.startsWith('https://')) {
    const normalizedPath = normalizeRepoPath(removeAnchor(href));
    return {
      type: guessFileNodeType(normalizedPath),
      sourceUrl: toBlobUrl(repoUrl, branch, normalizedPath),
      fetchUrl: toRawUrl(repoUrl, branch, normalizedPath),
      path: normalizedPath,
    };
  }

  const repoBase = repoUrl.replace(/\.git$/, '');
  const githubRepoMatch = /^https:\/\/github\.com\/([^/]+)\/([^/]+)/.exec(repoBase);
  if (!githubRepoMatch) {
    return {
      type: 'external',
      sourceUrl: href,
      fetchUrl: href,
    };
  }

  const owner = githubRepoMatch[1];
  const repo = githubRepoMatch[2];
  const normalizedRepoBase = `https://github.com/${owner}/${repo}`;

  const commitMatch = new RegExp(`^${escapeRegExp(normalizedRepoBase)}/commit/([0-9a-f]{7,40})`).exec(href);
  if (commitMatch) {
    const commitSha = commitMatch[1];
    return {
      type: 'commit',
      sourceUrl: href,
      fetchUrl: `${removeAnchor(href)}.patch`,
      commitSha,
    };
  }

  const blobMatch = new RegExp(`^${escapeRegExp(normalizedRepoBase)}/blob/([^/]+)/(.+?)(?:#.*)?$`).exec(href);
  if (blobMatch) {
    const targetBranch = decodeURIComponent(blobMatch[1]);
    const normalizedPath = normalizeRepoPath(decodeURIComponent(blobMatch[2]));
    return {
      type: guessFileNodeType(normalizedPath),
      sourceUrl: href,
      fetchUrl: toRawUrl(repoUrl, targetBranch, normalizedPath),
      path: normalizedPath,
    };
  }

  const issueMatch = new RegExp(`^${escapeRegExp(normalizedRepoBase)}/issues/(\\d+)`).exec(href);
  if (issueMatch) {
    return {
      type: 'issue',
      sourceUrl: href,
      fetchUrl: href,
    };
  }

  const discussionMatch = new RegExp(`^${escapeRegExp(normalizedRepoBase)}/discussions/(\\d+)`).exec(href);
  if (discussionMatch) {
    return {
      type: 'discussion',
      sourceUrl: href,
      fetchUrl: href,
    };
  }

  return {
    type: 'external',
    sourceUrl: href,
    fetchUrl: href,
  };
}

function isExcludedKnowledgePath(path: string): boolean {
  return DEFAULT_EXCLUDED_PATH_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`)
  );
}

function scoreEntry(entry: KnowledgeEntry, query: string, queryTokens: string[]): number {
  const title = entry.title.toLowerCase();
  const annotations = entry.annotations.join(' ').toLowerCase();
  const body = entry.body.toLowerCase();
  const path = (entry.path ?? '').toLowerCase();
  const queryLower = query.toLowerCase();
  let score = 0;

  if (title.includes(queryLower)) score += 40;
  if (annotations.includes(queryLower)) score += 25;
  if (body.includes(queryLower)) score += 14;
  if (path.includes(queryLower)) score += 20;

  for (const token of queryTokens) {
    if (title.includes(token)) score += 10;
    if (annotations.includes(token)) score += 7;
    if (path.includes(token)) score += 5;
    if (body.includes(token)) score += 4;
  }

  if (entry.type === 'readme') score += 2;
  if (entry.type === 'commit') score += 3;

  return score;
}

function buildSnippet(entry: KnowledgeEntry, query: string): string {
  const combined = [entry.annotations.join('\n'), entry.body].filter(Boolean).join('\n\n');
  if (!combined) {
    return entry.sourceUrl;
  }

  const lower = combined.toLowerCase();
  const queryTokens = tokenize(query);

  for (const token of [query.toLowerCase(), ...queryTokens]) {
    if (!token) {
      continue;
    }
    const index = lower.indexOf(token);
    if (index >= 0) {
      const start = Math.max(0, index - 120);
      const end = Math.min(combined.length, index + 220);
      return combined.slice(start, end).trim();
    }
  }

  return combined.slice(0, 320).trim();
}

function tokenize(input: string): string[] {
  return Array.from(
    new Set(
      input
        .toLowerCase()
        .split(/[^a-z0-9\u4e00-\u9fff]+/i)
        .map((token) => token.trim())
        .filter((token) => token.length >= 2)
    )
  );
}

function buildEntryId(resolved: ResolvedLink): string {
  if (resolved.type === 'commit' && resolved.commitSha) {
    return `commit:${resolved.commitSha}`;
  }
  if (resolved.path) {
    return `${resolved.type}:${resolved.path}`;
  }
  return `${resolved.type}:${resolved.sourceUrl}`;
}

function buildCacheKey(resolved: ResolvedLink): string {
  if (resolved.type === 'commit' && resolved.commitSha) {
    return `commit-${resolved.commitSha}`;
  }
  if (resolved.path) {
    return safeHash(`${resolved.type}:${resolved.path}`);
  }
  return safeHash(`${resolved.type}:${resolved.sourceUrl}`);
}

function safeHash(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

function normalizeRevision(revisionHeader: string | null, text: string): string {
  if (revisionHeader) {
    return revisionHeader.replace(/^W\//, '').replace(/"/g, '');
  }
  return safeHash(text);
}

function normalizeRepoPath(path: string): string {
  return decodeURIComponent(path)
    .replace(/^\.?\//, '')
    .replace(/^\/+/, '');
}

function toBlobUrl(repoUrl: string, branch: string, path: string): string {
  const repoBase = repoUrl.replace(/\.git$/, '');
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  return `${repoBase}/blob/${encodeURIComponent(branch)}/${encodedPath}`;
}

function toRawUrl(repoUrl: string, branch: string, path: string): string {
  const githubMatch = /^https:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/.exec(repoUrl);
  if (!githubMatch) {
    throw new Error(`Unsupported GitHub repository URL: ${repoUrl}`);
  }
  const owner = githubMatch[1];
  const repo = githubMatch[2];
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  return `https://raw.githubusercontent.com/${owner}/${repo}/${encodeURIComponent(branch)}/${encodedPath}`;
}

function removeAnchor(input: string): string {
  return input.replace(/#.*$/, '');
}

function extractHtmlText(html: string, sourceUrl: string): string {
  const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  const title = titleMatch ? decodeHtml(stripWhitespace(titleMatch[1])) : '';

  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');

  const text = decodeHtml(stripWhitespace(stripped));
  return [title, text, sourceUrl].filter(Boolean).join('\n\n');
}

function decodeHtml(input: string): string {
  return input
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripWhitespace(input: string): string {
  return input.replace(/\s+/g, ' ').trim();
}

function stripMarkdown(input: string): string {
  return input
    .replace(/!\[[^\]]*]\(([^)]+)\)/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncate(input: string, maxLength: number): string {
  if (input.length <= maxLength) {
    return input;
  }
  return `${input.slice(0, maxLength)}\n...`;
}

function guessFileNodeType(path: string): KnowledgeNodeType {
  return normalizeRepoPath(path).toLowerCase() === 'readme.md' ? 'readme' : 'file';
}

function isTextLikePath(path: string): boolean {
  return /\.(md|txt|ts|tsx|js|jsx|json|yaml|yml|css|scss|html|vue|svelte|cjs|mjs|sh|py|java|kt|go|rs|c|cc|cpp|h)$/i.test(path);
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
