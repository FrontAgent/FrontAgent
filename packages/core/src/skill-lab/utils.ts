import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export function normalizeText(input: string): string {
  return input.toLowerCase().replace(/\s+/g, ' ').trim();
}

export function sanitizeToken(input: string): string {
  return input
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

export function timestampId(): string {
  return new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
}

export function writeJsonFile(path: string, data: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, 'utf-8');
}

export function stripCodeFences(input: string): string {
  const trimmed = input.trim();
  const fenced = trimmed.match(/^```(?:[a-zA-Z0-9_-]+)?\s*\n([\s\S]*?)\n```$/);
  return fenced ? fenced[1].trim() : trimmed;
}

export function extractReferencedFilesFromMarkdown(markdown: string): string[] {
  const matches = markdown.matchAll(/`((?:references|assets)\/[^`]+)`/g);
  const paths = new Set<string>();
  for (const match of matches) {
    if (match[1]) {
      paths.add(match[1]);
    }
  }
  return Array.from(paths);
}

export function readOptionalFile(path: string): string | undefined {
  if (!existsSync(path)) {
    return undefined;
  }
  return readFileSync(path, 'utf-8');
}

export function truncateText(input: string, maxLength: number): string {
  if (input.length <= maxLength) {
    return input;
  }
  return `${input.slice(0, maxLength)}\n...`;
}
