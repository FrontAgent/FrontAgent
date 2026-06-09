import type { ProjectFactsSnapshot } from '../types.js';
import type { MemoryEntry, MemoryIndex, MemoryTopic, PersistenceInput } from './types.js';
import { MEMORY_INDEX_VERSION } from './types.js';

export function buildProjectStructureTopic(
  input: PersistenceInput,
  existingEntries: MemoryEntry[],
  now = new Date().toISOString(),
): MemoryTopic {
  const entries = cloneEntries(existingEntries);

  for (const filePath of input.createdFiles) {
    const existingEntry = entries.find((entry) => entry.key === filePath);
    if (existingEntry) {
      existingEntry.updatedAt = now;
      continue;
    }
    entries.push({
      key: filePath,
      content: `File created during task: "${input.taskDescription}"`,
      updatedAt: now,
      tags: inferPersistenceTags(filePath),
    });
  }

  const capped = entries.slice(-200);

  return {
    meta: {
      id: 'project-structure',
      title: 'Project Structure',
      summary: `${capped.length} tracked files`,
      updatedAt: now,
      charCount: 0,
    },
    entries: capped,
  };
}

export function buildDependenciesTopic(
  input: PersistenceInput,
  existingEntries: MemoryEntry[],
  now = new Date().toISOString(),
): MemoryTopic | null {
  const entries = cloneEntries(existingEntries);

  for (const pkg of input.dependencyChanges.installed) {
    const existingEntry = entries.find((entry) => entry.key === pkg);
    if (existingEntry) {
      existingEntry.content = 'Installed';
      existingEntry.updatedAt = now;
      continue;
    }
    entries.push({
      key: pkg,
      content: 'Installed',
      updatedAt: now,
      tags: ['dependency', 'npm'],
    });
  }

  for (const pkg of input.dependencyChanges.missing) {
    const existingEntry = entries.find((entry) => entry.key === pkg);
    if (!existingEntry) {
      entries.push({
        key: pkg,
        content: 'Known missing dependency',
        updatedAt: now,
        tags: ['dependency', 'missing'],
      });
    }
  }

  if (entries.length === 0) {
    return null;
  }

  return {
    meta: {
      id: 'dependencies',
      title: 'Dependencies',
      summary: `${entries.length} tracked packages`,
      updatedAt: now,
      charCount: 0,
    },
    entries,
  };
}

export function buildErrorsTopic(
  input: PersistenceInput,
  existingEntries: MemoryEntry[],
  now = new Date().toISOString(),
): MemoryTopic | null {
  if (input.errorResolutions.length === 0) {
    return null;
  }

  const entries = cloneEntries(existingEntries);

  for (const resolution of input.errorResolutions) {
    const key = `${resolution.errorType}: ${resolution.errorMessage}`.slice(0, 120);
    const existingEntry = entries.find((entry) => entry.key === key);

    if (existingEntry) {
      existingEntry.content = resolution.resolution;
      existingEntry.updatedAt = now;
      continue;
    }

    entries.push({
      key,
      content: resolution.resolution,
      updatedAt: now,
      tags: ['error', resolution.errorType],
    });
  }

  const capped = entries.slice(-50);

  return {
    meta: {
      id: 'errors',
      title: 'Error Resolutions',
      summary: `${capped.length} recorded resolutions`,
      updatedAt: now,
      charCount: 0,
    },
    entries: capped,
  };
}

export function buildMemoryIndex(
  snapshot: ProjectFactsSnapshot,
  topics: MemoryTopic['meta'][],
  now = new Date().toISOString(),
): MemoryIndex {
  return {
    version: MEMORY_INDEX_VERSION,
    projectRoot: snapshot.project.buildStatus ? '(from snapshot)' : '',
    updatedAt: now,
    topics,
  };
}

export function renderGatewayCapture(input: PersistenceInput): string {
  const lines = [`Task: ${input.taskDescription}`];

  if (input.createdFiles.length > 0) {
    lines.push(`Created files: ${input.createdFiles.join(', ')}`);
  }
  if (input.dependencyChanges.installed.length > 0) {
    lines.push(`Installed dependencies: ${input.dependencyChanges.installed.join(', ')}`);
  }
  if (input.dependencyChanges.missing.length > 0) {
    lines.push(`Missing dependencies: ${input.dependencyChanges.missing.join(', ')}`);
  }
  if (input.errorResolutions.length > 0) {
    lines.push('Error resolutions:');
    for (const resolution of input.errorResolutions) {
      lines.push(
        `- ${resolution.errorType}: ${resolution.errorMessage} -> ${resolution.resolution}`,
      );
    }
  }

  return lines.join('\n');
}

export function inferPersistenceTags(filePath: string): string[] {
  const tags: string[] = [];
  const lower = filePath.toLowerCase();

  if (lower.includes('/components/')) tags.push('component');
  if (lower.includes('/pages/') || lower.includes('/views/')) tags.push('page');
  if (lower.includes('/store/') || lower.includes('/stores/')) tags.push('store');
  if (lower.includes('/api/') || lower.includes('/services/')) tags.push('api');
  if (lower.includes('/utils/') || lower.includes('/helpers/')) tags.push('util');
  if (lower.endsWith('.test.ts') || lower.endsWith('.test.tsx') || lower.endsWith('.spec.ts')) {
    tags.push('test');
  }
  if (lower.endsWith('.css') || lower.endsWith('.scss') || lower.endsWith('.less')) {
    tags.push('style');
  }

  return tags;
}

function cloneEntries(entries: MemoryEntry[]): MemoryEntry[] {
  return entries.map((entry) => ({
    ...entry,
    tags: [...entry.tags],
  }));
}
