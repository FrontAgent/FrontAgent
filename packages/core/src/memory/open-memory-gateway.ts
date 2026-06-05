import { randomBytes } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';

export type OpenMemoryGatewayStatus = 'draft' | 'active' | 'archived' | 'rejected';

export interface OpenMemoryGatewayAdapterOptions {
  rootDir: string;
  captureSource?: string;
  autoApprove?: boolean;
}

export interface OpenMemoryGatewayCaptureInput {
  content: string;
  tags?: string[];
  scope?: string;
  source?: string;
}

export interface OpenMemoryGatewayRecord {
  id: string;
  status: OpenMemoryGatewayStatus;
  scope: string;
  source: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  content: string;
  path: string;
}

const MEMORY_ID_PATTERN = /^mem_[0-9]{8}_[a-z0-9]+$/;

export class OpenMemoryGatewayAdapter {
  private readonly rootDir: string;
  private readonly captureSource: string;
  private readonly autoApprove: boolean;

  constructor(options: OpenMemoryGatewayAdapterOptions) {
    this.rootDir = options.rootDir;
    this.captureSource = options.captureSource ?? 'frontagent';
    this.autoApprove = options.autoApprove ?? false;
  }

  captureDraft(input: OpenMemoryGatewayCaptureInput): OpenMemoryGatewayRecord {
    const content = input.content.trim();
    if (!content) {
      throw new Error('Memory content is required');
    }

    const now = new Date().toISOString();
    const status: OpenMemoryGatewayStatus = this.autoApprove ? 'active' : 'draft';
    const record: OpenMemoryGatewayRecord = {
      id: createMemoryId(new Date(now)),
      status,
      scope: input.scope ?? 'personal',
      source: input.source ?? this.captureSource,
      tags: normalizeTags(input.tags),
      createdAt: now,
      updatedAt: now,
      content,
      path: this.memoryFilePath(status, ''),
    };
    record.path = this.memoryFilePath(status, record.id);

    const file = serializeRecord(record);
    mkdirSync(dirname(record.path), { recursive: true });
    writeFileAtomically(record.path, file);
    return record;
  }

  listActive(): OpenMemoryGatewayRecord[] {
    const activeDir = join(this.rootDir, 'memory', 'active');
    if (!existsSync(activeDir)) {
      return [];
    }

    const records: OpenMemoryGatewayRecord[] = [];
    for (const entry of readdirSync(activeDir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
      const filePath = join(activeDir, entry.name);
      const record = readRecord(filePath);
      if (record?.status === 'active') {
        records.push(record);
      }
    }

    return records.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  hasActiveMemories(): boolean {
    return this.listActive().length > 0;
  }

  private memoryFilePath(status: OpenMemoryGatewayStatus, id: string): string {
    const statusDir = status === 'active' ? 'active' : status === 'archived' ? 'archived' : 'inbox';
    return join(this.rootDir, 'memory', statusDir, `${id}.md`);
  }
}

function createMemoryId(now = new Date()): string {
  const yyyymmdd = now.toISOString().slice(0, 10).replaceAll('-', '');
  const suffix = randomBytes(4).toString('hex');
  return `mem_${yyyymmdd}_${suffix}`;
}

function normalizeTags(tags: string[] = []): string[] {
  return [...new Set(tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean))];
}

function serializeRecord(record: OpenMemoryGatewayRecord): string {
  const lines = [
    '---',
    `id: ${record.id}`,
    `status: ${record.status}`,
    `scope: ${record.scope}`,
    `source: ${record.source}`,
    'tags:',
    ...record.tags.map((tag) => `  - ${tag}`),
    `createdAt: "${record.createdAt}"`,
    `updatedAt: "${record.updatedAt}"`,
    '---',
    record.content,
    '',
  ];
  return lines.join('\n');
}

function readRecord(filePath: string): OpenMemoryGatewayRecord | null {
  try {
    const raw = readFileSync(filePath, 'utf-8');
    const parsed = parseFrontmatter(raw);
    if (!parsed) return null;
    const status = parseStatus(parsed.data.status);
    if (!MEMORY_ID_PATTERN.test(parsed.data.id ?? '')) return null;
    if (!status) return null;

    return {
      id: parsed.data.id,
      status,
      scope: parsed.data.scope ?? 'personal',
      source: parsed.data.source ?? 'manual',
      tags: parsed.data.tags ? normalizeTags(parsed.data.tags.split(',')) : [],
      createdAt: parsed.data.createdAt ?? '',
      updatedAt: parsed.data.updatedAt ?? '',
      content: parsed.content.trim(),
      path: filePath,
    };
  } catch {
    return null;
  }
}

function parseFrontmatter(raw: string): { data: Record<string, string>; content: string } | null {
  const lines = raw.split('\n');
  if (lines[0] !== '---') return null;

  const data: Record<string, string> = {};
  let i = 1;
  while (i < lines.length) {
    const line = lines[i];
    if (line === '---') {
      return { data, content: lines.slice(i + 1).join('\n') };
    }
    const keyValue = line.match(/^([A-Za-z][A-Za-z0-9]*):\s*(.*)$/);
    if (keyValue) {
      const key = keyValue[1];
      const value = stripQuotes(keyValue[2].trim());
      if (key === 'tags') {
        const tags: string[] = [];
        i++;
        while (i < lines.length && lines[i].startsWith('  - ')) {
          tags.push(stripQuotes(lines[i].slice(4).trim()));
          i++;
        }
        data.tags = tags.join(',');
        continue;
      }
      data[key] = value === '[]' ? '' : value;
    }
    i++;
  }
  return null;
}

function stripQuotes(value: string): string {
  return value.replace(/^["']|["']$/g, '');
}

function parseStatus(status?: string): OpenMemoryGatewayStatus | null {
  if (status === 'draft' || status === 'active' || status === 'archived' || status === 'rejected') {
    return status;
  }
  return null;
}

function writeFileAtomically(filePath: string, content: string): void {
  const tempPath = join(dirname(filePath), `.${Date.now()}.${randomBytes(4).toString('hex')}.tmp`);
  try {
    writeFileSync(tempPath, content, 'utf-8');
    renameSync(tempPath, filePath);
  } catch (error) {
    rmSync(tempPath, { force: true });
    throw error;
  }
}
