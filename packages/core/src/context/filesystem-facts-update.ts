import type { ProjectFacts } from '../types.js';
import { parentDirectoriesForPath } from './helpers.js';

type ToolResult = { success?: boolean; error?: string; [key: string]: unknown };

function addToSet(set: Set<string>, value: string): boolean {
  const before = set.size;
  set.add(value);
  return set.size !== before;
}

function removeFromSet(set: Set<string>, value: string): boolean {
  return set.delete(value);
}

function setStringArrayMap(map: Map<string, string[]>, key: string, value: string[]): boolean {
  const previous = map.get(key);
  if (
    previous &&
    previous.length === value.length &&
    previous.every((item, idx) => item === value[idx])
  ) {
    return false;
  }
  map.set(key, value);
  return true;
}

export function updateFilesystemFactsFromToolResult(
  facts: ProjectFacts,
  toolName: string,
  params: Record<string, unknown>,
  result: ToolResult,
): boolean {
  let changed = false;

  // Handle filesense navigation results - consume explicit factsDelta instead of guessing result shape.
  if (toolName.startsWith('filesense_')) {
    const data = result.data as
      | { factsDelta?: { existingFiles?: string[]; existingDirectories?: string[] } }
      | undefined;
    const factsDelta = data?.factsDelta;
    if (result.success && factsDelta) {
      for (const file of factsDelta.existingFiles ?? []) {
        changed = addToSet(facts.filesystem.existingFiles, file) || changed;
        changed = removeFromSet(facts.filesystem.nonExistentPaths, file) || changed;
      }
      for (const dir of factsDelta.existingDirectories ?? []) {
        changed = addToSet(facts.filesystem.existingDirectories, dir) || changed;
        changed = removeFromSet(facts.filesystem.nonExistentPaths, dir) || changed;
      }
    }
  }

  // Handle filesense tool results - enrich ProjectFacts from index data
  if (
    toolName === 'filesense_sync' ||
    toolName === 'filesense_sync_and_summarize' ||
    toolName === 'filesense_query'
  ) {
    if (result.success && result.data) {
      const data = result.data as Record<string, unknown>;

      // For query results, extract file/directory existence from the index
      const index = (data.index ?? (data as { sync?: unknown }).sync) as
        | { children?: Array<{ name: string; path: string; type: string }> }
        | undefined;
      if (index?.children) {
        for (const child of index.children) {
          if (child.type === 'file') {
            changed = addToSet(facts.filesystem.existingFiles, child.path) || changed;
            changed = removeFromSet(facts.filesystem.nonExistentPaths, child.path) || changed;
          } else if (child.type === 'dir') {
            changed = addToSet(facts.filesystem.existingDirectories, child.path) || changed;
            changed = removeFromSet(facts.filesystem.nonExistentPaths, child.path) || changed;
          }
        }
      }

      // For sync results, mark the root as existing directory
      const root = data.root as string | undefined;
      if (root) {
        changed = addToSet(facts.filesystem.existingDirectories, root) || changed;
      }
    }
  }

  switch (toolName) {
    case 'create_file':
    case 'apply_patch': {
      const path = params.path as string;
      if (result.success) {
        changed = addToSet(facts.filesystem.existingFiles, path) || changed;
        changed = removeFromSet(facts.filesystem.nonExistentPaths, path) || changed;
      } else if (result.error?.includes('not found')) {
        changed = addToSet(facts.filesystem.nonExistentPaths, path) || changed;
      }
      break;
    }
    case 'read_file': {
      const path = params.path as string;
      // Check skipped and exists fields to correctly record missing files.
      if (result.success && !result.skipped) {
        changed = addToSet(facts.filesystem.existingFiles, path) || changed;
        changed = removeFromSet(facts.filesystem.nonExistentPaths, path) || changed;
      } else if (result.skipped && result.exists === false) {
        changed = addToSet(facts.filesystem.nonExistentPaths, path) || changed;
        changed = removeFromSet(facts.filesystem.existingFiles, path) || changed;
      } else if (result.error?.includes('not found') || result.error?.includes('does not exist')) {
        changed = addToSet(facts.filesystem.nonExistentPaths, path) || changed;
        changed = removeFromSet(facts.filesystem.existingFiles, path) || changed;
      }
      break;
    }
    case 'list_directory': {
      const path = params.path as string;
      if (result.success && !result.skipped && Array.isArray(result.entries)) {
        changed = addToSet(facts.filesystem.existingDirectories, path) || changed;

        const entries = result.entries as Array<{ name: string; path: string; type: string }>;

        changed =
          setStringArrayMap(
            facts.filesystem.directoryContents,
            path,
            entries.map((e) => e.path),
          ) || changed;

        for (const entry of entries) {
          if (entry.type === 'file') {
            changed = addToSet(facts.filesystem.existingFiles, entry.path) || changed;
            changed = removeFromSet(facts.filesystem.nonExistentPaths, entry.path) || changed;
          } else if (entry.type === 'directory') {
            changed = addToSet(facts.filesystem.existingDirectories, entry.path) || changed;
            changed = removeFromSet(facts.filesystem.nonExistentPaths, entry.path) || changed;
          }
        }
      } else if (result.skipped || result.error?.includes('not found')) {
        changed = addToSet(facts.filesystem.nonExistentPaths, path) || changed;
      }
      break;
    }
    case 'search_code': {
      if (!result.success) {
        break;
      }

      const files = new Set<string>();

      if (Array.isArray(result.files)) {
        for (const file of result.files) {
          if (typeof file === 'string') {
            files.add(file);
          }
        }
      }

      if (Array.isArray(result.matches)) {
        for (const match of result.matches as Array<{ file?: unknown }>) {
          if (typeof match.file === 'string') {
            files.add(match.file);
          }
        }
      }

      for (const file of files) {
        changed = addToSet(facts.filesystem.existingFiles, file) || changed;
        changed = removeFromSet(facts.filesystem.nonExistentPaths, file) || changed;

        for (const parent of parentDirectoriesForPath(file)) {
          changed = addToSet(facts.filesystem.existingDirectories, parent) || changed;
          changed = removeFromSet(facts.filesystem.nonExistentPaths, parent) || changed;
        }
      }
      break;
    }
  }

  return changed;
}
