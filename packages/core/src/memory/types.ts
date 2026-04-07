import type { ProjectFactsSnapshot } from '../types.js';

export interface MemoryConfig {
  /** Whether the memory system is enabled (default true) */
  enabled?: boolean;
  /** Root directory for memory storage (default <projectRoot>/.frontagent/memory) */
  memoryDir?: string;
  /** Max characters to inject from memory at startup (default 8000) */
  preloadBudgetChars?: number;
  /** Max characters of memory context per code-gen call (default 2000) */
  recallBudgetChars?: number;
  /** Max topic files to load at startup (default 10) */
  maxTopicFiles?: number;
}

export interface MemoryTopicMeta {
  /** Topic file name without extension (e.g. "project-structure") */
  id: string;
  /** Human-readable title */
  title: string;
  /** One-line summary */
  summary: string;
  /** Last updated ISO timestamp */
  updatedAt: string;
  /** Approximate character count of the topic file */
  charCount: number;
}

export interface MemoryIndex {
  /** Schema version for forward compatibility */
  version: number;
  /** Project root this memory belongs to */
  projectRoot: string;
  /** When the index was last updated */
  updatedAt: string;
  /** Topic summaries */
  topics: MemoryTopicMeta[];
}

export interface MemoryEntry {
  /** Unique key within the topic (e.g. "src/App.tsx" for file entries) */
  key: string;
  /** The memory content */
  content: string;
  /** When this entry was created or last updated */
  updatedAt: string;
  /** Tags for recall matching */
  tags: string[];
}

export interface MemoryTopic {
  meta: MemoryTopicMeta;
  entries: MemoryEntry[];
}

export interface RecallQuery {
  /** File path being operated on */
  filePath?: string;
  /** Step action type */
  action?: string;
  /** Free-text query or task description */
  text?: string;
  /** Tags to match */
  tags?: string[];
}

export interface RecalledMemory {
  topicId: string;
  entryKey: string;
  content: string;
  /** Simple relevance score 0-1 */
  score: number;
}

export interface PersistenceInput {
  /** Serializable facts snapshot to persist */
  factsSnapshot: ProjectFactsSnapshot;
  /** New files created during this task */
  createdFiles: string[];
  /** Error resolutions that occurred */
  errorResolutions: Array<{
    errorType: string;
    errorMessage: string;
    resolution: string;
  }>;
  /** Dependency changes */
  dependencyChanges: {
    installed: string[];
    missing: string[];
  };
  /** Task description for context */
  taskDescription: string;
}

export const MEMORY_INDEX_VERSION = 1;
export const DEFAULT_PRELOAD_BUDGET_CHARS = 8000;
export const DEFAULT_RECALL_BUDGET_CHARS = 2000;
export const DEFAULT_MAX_TOPIC_FILES = 10;
export const MEMORY_DIR_NAME = '.frontagent/memory';
export const TOPICS_DIR_NAME = 'topics';
export const SNAPSHOTS_DIR_NAME = 'snapshots';
export const INDEX_FILE_NAME = 'MEMORY.md';
export const FACTS_SNAPSHOT_FILE_NAME = 'facts-latest.json';
