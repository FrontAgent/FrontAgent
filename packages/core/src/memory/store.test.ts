import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectFactsSnapshot } from '../types.js';
import { MemoryStore } from './store.js';
import type { PersistenceInput } from './types.js';
import {
  FACTS_SNAPSHOT_FILE_NAME,
  INDEX_FILE_NAME,
  MEMORY_DIR_NAME,
  MEMORY_INDEX_VERSION,
  SNAPSHOTS_DIR_NAME,
  TOPICS_DIR_NAME,
} from './types.js';

vi.mock('node:fs');
vi.mock('@frontagent/shared', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const PROJECT_ROOT = '/tmp/test-project';
const MEMORY_DIR = join(PROJECT_ROOT, MEMORY_DIR_NAME);
const SNAPSHOTS_DIR = join(MEMORY_DIR, SNAPSHOTS_DIR_NAME);

// --- Helpers ---

function makeIndexContent(topics: Array<{ title: string; id: string; summary: string }>): string {
  const lines = [
    '# FrontAgent Memory',
    '',
    `Project: \`${PROJECT_ROOT}\``,
    'Updated: 2024-01-01T00:00:00.000Z',
    '',
    '## Topics',
    '',
  ];
  for (const t of topics) {
    lines.push(
      `- [${t.title}](topics/${t.id}.md) — ${t.summary} (updated: 2024-01-01T00:00:00.000Z, ~500 chars)`,
    );
  }
  lines.push('');
  return lines.join('\n');
}

function makeTopicContent(
  title: string,
  entries: Array<{ key: string; content: string; tags?: string[] }>,
): string {
  const lines = [`# ${title}`, ''];
  for (const e of entries) {
    const tagsStr = e.tags && e.tags.length > 0 ? ` [tags: ${e.tags.join(', ')}]` : '';
    lines.push(`### ${e.key}${tagsStr} (updated: 2024-01-01T00:00:00.000Z)`);
    lines.push('');
    lines.push(e.content);
    lines.push('');
  }
  return lines.join('\n');
}

function createFactsSnapshot(overrides?: Partial<ProjectFactsSnapshot>): ProjectFactsSnapshot {
  return {
    revision: 1,
    filesystem: {
      existingFiles: [],
      existingDirectories: [],
      nonExistentPaths: [],
      directoryContents: {},
    },
    dependencies: {
      installedPackages: [],
      missingPackages: [],
    },
    project: {
      devServerRunning: false,
      buildStatus: 'success',
    },
    moduleDependencyGraph: {
      modules: {},
      dependencies: {},
      reverseDependencies: {},
    },
    errors: [],
    ...overrides,
  };
}

// --- Test suites ---

describe('MemoryStore', () => {
  let store: MemoryStore;
  const mockedExistsSync = vi.mocked(existsSync);
  const mockedReadFileSync = vi.mocked(readFileSync);
  const mockedWriteFileSync = vi.mocked(writeFileSync);
  const mockedMkdirSync = vi.mocked(mkdirSync);
  const mockedReaddirSync = vi.mocked(readdirSync);

  beforeEach(() => {
    vi.clearAllMocks();
    mockedExistsSync.mockReturnValue(false);
    mockedMkdirSync.mockReturnValue(undefined);
    mockedWriteFileSync.mockReturnValue(undefined);
    store = new MemoryStore(PROJECT_ROOT);
  });

  // -------------------------------------------------------------------------
  // CRUD Operations
  // -------------------------------------------------------------------------

  describe('CRUD operations', () => {
    it('loadIndex returns null when index file does not exist', () => {
      mockedExistsSync.mockReturnValue(false);
      expect(store.loadIndex()).toBeNull();
    });

    it('loadIndex parses a valid index file', () => {
      const indexContent = makeIndexContent([
        { title: 'Project Structure', id: 'project-structure', summary: '5 tracked files' },
        { title: 'Errors', id: 'errors', summary: '3 recorded resolutions' },
      ]);
      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockReturnValue(indexContent);

      const index = store.loadIndex();
      expect(index).not.toBeNull();
      expect(index!.projectRoot).toBe(PROJECT_ROOT);
      expect(index!.topics).toHaveLength(2);
      expect(index!.topics[0].id).toBe('project-structure');
      expect(index!.topics[0].title).toBe('Project Structure');
      expect(index!.topics[1].id).toBe('errors');
    });

    it('loadIndex returns null for corrupted index file', () => {
      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockImplementation(() => {
        throw new Error('ENOENT');
      });

      expect(store.loadIndex()).toBeNull();
    });

    it('loadTopic returns null when topic file does not exist', () => {
      mockedExistsSync.mockReturnValue(false);
      expect(store.loadTopic('nonexistent')).toBeNull();
    });

    it('loadTopic parses a valid topic file with entries', () => {
      const topicContent = makeTopicContent('Error Resolutions', [
        {
          key: 'TypeError: x is not a function',
          content: 'Check import path',
          tags: ['error', 'TypeError'],
        },
        { key: 'ReferenceError: y is not defined', content: 'Add missing import', tags: ['error'] },
      ]);
      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockReturnValue(topicContent);

      const topic = store.loadTopic('errors');
      expect(topic).not.toBeNull();
      expect(topic!.meta.title).toBe('Error Resolutions');
      expect(topic!.entries).toHaveLength(2);
      expect(topic!.entries[0].key).toBe('TypeError: x is not a function');
      expect(topic!.entries[0].content).toBe('Check import path');
      expect(topic!.entries[0].tags).toEqual(['error', 'TypeError']);
    });

    it('loadTopic caches results on subsequent calls', () => {
      const topicContent = makeTopicContent('Deps', [
        { key: 'react', content: 'Installed', tags: ['dependency'] },
      ]);
      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockReturnValue(topicContent);

      const first = store.loadTopic('deps');
      const second = store.loadTopic('deps');
      expect(first).toBe(second); // Same reference from cache
      expect(mockedReadFileSync).toHaveBeenCalledTimes(1);
    });

    it('loadTopic returns null for corrupted topic file', () => {
      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockImplementation(() => {
        throw new Error('read error');
      });

      expect(store.loadTopic('corrupted')).toBeNull();
    });

    it('persist creates new topic entries for created files', () => {
      // Simulate no existing topic
      mockedExistsSync.mockImplementation((p) => {
        const path = p as string;
        if (path.includes(INDEX_FILE_NAME)) return false;
        if (path.includes(TOPICS_DIR_NAME)) return false;
        return false;
      });

      const input: PersistenceInput = {
        factsSnapshot: createFactsSnapshot(),
        createdFiles: ['src/App.tsx', 'src/utils/helper.ts'],
        errorResolutions: [],
        dependencyChanges: { installed: [], missing: [] },
        taskDescription: 'Create initial components',
      };

      store.persist(input);

      // Should have written topic files
      expect(mockedWriteFileSync).toHaveBeenCalled();
      const writeCalls = mockedWriteFileSync.mock.calls;
      const topicWrite = writeCalls.find((c) => (c[0] as string).includes('project-structure.md'));
      expect(topicWrite).toBeDefined();
      const content = topicWrite![1] as string;
      expect(content).toContain('src/App.tsx');
      expect(content).toContain('src/utils/helper.ts');
    });

    it('persist updates existing entries without duplicating them', () => {
      const existingTopic = makeTopicContent('Project Structure', [
        { key: 'src/App.tsx', content: 'File created during task: "init"', tags: ['component'] },
      ]);

      mockedExistsSync.mockImplementation((p) => {
        const path = p as string;
        if (path.includes('project-structure.md')) return true;
        if (path.includes(TOPICS_DIR_NAME) && !path.endsWith('.md')) return true;
        return false;
      });
      mockedReadFileSync.mockReturnValue(existingTopic);

      const input: PersistenceInput = {
        factsSnapshot: createFactsSnapshot(),
        createdFiles: ['src/App.tsx'], // Same file again
        errorResolutions: [],
        dependencyChanges: { installed: [], missing: [] },
        taskDescription: 'Update component',
      };

      store.persist(input);

      const writeCalls = mockedWriteFileSync.mock.calls;
      const topicWrite = writeCalls.find((c) => (c[0] as string).includes('project-structure.md'));
      expect(topicWrite).toBeDefined();
      const content = topicWrite![1] as string;
      // Should only have one entry for src/App.tsx, not two
      const matches = content.match(/### src\/App\.tsx/g);
      expect(matches).toHaveLength(1);
    });

    it('persist records error resolutions', () => {
      mockedExistsSync.mockReturnValue(false);

      const input: PersistenceInput = {
        factsSnapshot: createFactsSnapshot(),
        createdFiles: [],
        errorResolutions: [
          {
            errorType: 'TypeError',
            errorMessage: 'Cannot read property x',
            resolution: 'Add null check',
          },
        ],
        dependencyChanges: { installed: [], missing: [] },
        taskDescription: 'Fix bug',
      };

      store.persist(input);

      const writeCalls = mockedWriteFileSync.mock.calls;
      const errorsWrite = writeCalls.find((c) => (c[0] as string).includes('errors.md'));
      expect(errorsWrite).toBeDefined();
      const content = errorsWrite![1] as string;
      expect(content).toContain('TypeError: Cannot read property x');
      expect(content).toContain('Add null check');
    });

    it('persist records dependency changes', () => {
      mockedExistsSync.mockReturnValue(false);

      const input: PersistenceInput = {
        factsSnapshot: createFactsSnapshot(),
        createdFiles: [],
        errorResolutions: [],
        dependencyChanges: { installed: ['lodash', 'axios'], missing: ['moment'] },
        taskDescription: 'Add deps',
      };

      store.persist(input);

      const writeCalls = mockedWriteFileSync.mock.calls;
      const depsWrite = writeCalls.find((c) => (c[0] as string).includes('dependencies.md'));
      expect(depsWrite).toBeDefined();
      const content = depsWrite![1] as string;
      expect(content).toContain('lodash');
      expect(content).toContain('axios');
      expect(content).toContain('moment');
      expect(content).toContain('Known missing dependency');
    });
  });

  // -------------------------------------------------------------------------
  // Serialization / Deserialization
  // -------------------------------------------------------------------------

  describe('serialization and deserialization', () => {
    it('round-trips index through serialize/parse', () => {
      const indexContent = makeIndexContent([
        { title: 'Patterns', id: 'patterns', summary: 'Code patterns' },
      ]);
      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockReturnValue(indexContent);

      const index = store.loadIndex();
      expect(index).not.toBeNull();
      expect(index!.version).toBe(MEMORY_INDEX_VERSION);
      expect(index!.topics[0].title).toBe('Patterns');
      expect(index!.topics[0].charCount).toBe(500);
    });

    it('round-trips topic entries with tags and timestamps', () => {
      const topicContent = makeTopicContent('Test Topic', [
        { key: 'entry-1', content: 'Content for entry 1', tags: ['tag-a', 'tag-b'] },
        { key: 'entry-2', content: 'Content for entry 2', tags: [] },
      ]);
      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockReturnValue(topicContent);

      const topic = store.loadTopic('test-topic');
      expect(topic!.entries[0].tags).toEqual(['tag-a', 'tag-b']);
      expect(topic!.entries[0].updatedAt).toBe('2024-01-01T00:00:00.000Z');
      expect(topic!.entries[1].tags).toEqual([]);
    });

    it('loadFactsSnapshot deserializes JSON correctly', () => {
      const snapshot = createFactsSnapshot({ revision: 42 });
      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockReturnValue(JSON.stringify(snapshot));

      const loaded = store.loadFactsSnapshot();
      expect(loaded).not.toBeNull();
      expect(loaded!.revision).toBe(42);
      expect(loaded!.project.buildStatus).toBe('success');
    });

    it('loadFactsSnapshot returns null for corrupted JSON', () => {
      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockImplementation(() => {
        throw new Error('parse error');
      });

      expect(store.loadFactsSnapshot()).toBeNull();
    });

    it('writeFactsSnapshot serializes with indentation', () => {
      mockedExistsSync.mockReturnValue(true);
      const snapshot = createFactsSnapshot({ revision: 7 });

      store.writeFactsSnapshot(snapshot);

      expect(mockedWriteFileSync).toHaveBeenCalledWith(
        join(SNAPSHOTS_DIR, FACTS_SNAPSHOT_FILE_NAME),
        JSON.stringify(snapshot, null, 2),
        'utf-8',
      );
    });
  });

  // -------------------------------------------------------------------------
  // Capacity Limits and Eviction
  // -------------------------------------------------------------------------

  describe('capacity limits and eviction', () => {
    it('preload respects maxTopicFiles limit', () => {
      const topics = Array.from({ length: 15 }, (_, i) => ({
        title: `Topic ${i}`,
        id: `topic-${i}`,
        summary: `Summary ${i}`,
      }));
      const indexContent = makeIndexContent(topics);

      // Store with maxTopicFiles = 3
      const limitedStore = new MemoryStore(PROJECT_ROOT, { maxTopicFiles: 3 });

      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockImplementation((p) => {
        const path = p as string;
        if (path.includes(INDEX_FILE_NAME)) return indexContent;
        // Return a small topic for each
        const idMatch = path.match(/topic-(\d+)\.md/);
        if (idMatch) {
          return makeTopicContent(`Topic ${idMatch[1]}`, [
            { key: `key-${idMatch[1]}`, content: `Short content ${idMatch[1]}` },
          ]);
        }
        return '';
      });

      const result = limitedStore.preload();
      expect(result).not.toBeNull();
      // renderTopicForPreload outputs "### {title}" for each loaded topic
      const topicHeaders = result!.match(/^### Topic \d+/gm) || [];
      expect(topicHeaders.length).toBe(3);
      // Also verify readFileSync was called for exactly 3 topic files (plus the index)
      const topicReadCalls = mockedReadFileSync.mock.calls.filter(
        (c) => (c[0] as string).includes('topic-') && (c[0] as string).endsWith('.md'),
      );
      expect(topicReadCalls.length).toBe(3);
    });

    it('preload respects character budget and truncates when needed', () => {
      const topics = [{ title: 'Big Topic', id: 'big', summary: 'Large content' }];
      const indexContent = makeIndexContent(topics);
      // Create content that exceeds a small budget
      const bigContent = 'x'.repeat(500);

      const smallBudgetStore = new MemoryStore(PROJECT_ROOT, { preloadBudgetChars: 100 });

      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockImplementation((p) => {
        const path = p as string;
        if (path.includes(INDEX_FILE_NAME)) return indexContent;
        return makeTopicContent('Big Topic', [{ key: 'big-entry', content: bigContent }]);
      });

      const result = smallBudgetStore.preload();
      // Result should be truncated. The header "## 项目记忆 (跨会话持久化)" is ~30 chars,
      // so total output should not exceed budget (100) + initial header length (~35).
      if (result) {
        expect(result.length).toBeLessThanOrEqual(140);
        expect(result).toContain('...(truncated)');
      }
    });

    it('preload sorts topics by most recently updated first (eviction preserves most-recently-accessed)', () => {
      // Create index with topics having different update times
      const indexLines = [
        '# FrontAgent Memory',
        '',
        `Project: \`${PROJECT_ROOT}\``,
        'Updated: 2024-01-01T00:00:00.000Z',
        '',
        '## Topics',
        '',
        '- [Old Topic](topics/old.md) — old stuff (updated: 2023-01-01T00:00:00.000Z, ~100 chars)',
        '- [New Topic](topics/new.md) — new stuff (updated: 2024-06-01T00:00:00.000Z, ~100 chars)',
        '- [Mid Topic](topics/mid.md) — mid stuff (updated: 2024-03-01T00:00:00.000Z, ~100 chars)',
        '',
      ].join('\n');

      // Only allow 1 topic to be loaded
      const limitedStore = new MemoryStore(PROJECT_ROOT, { maxTopicFiles: 1 });

      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockImplementation((p) => {
        const path = p as string;
        if (path.includes(INDEX_FILE_NAME)) return indexLines;
        if (path.includes('new.md')) {
          return makeTopicContent('New Topic', [{ key: 'new-key', content: 'newest content' }]);
        }
        if (path.includes('mid.md')) {
          return makeTopicContent('Mid Topic', [{ key: 'mid-key', content: 'middle content' }]);
        }
        if (path.includes('old.md')) {
          return makeTopicContent('Old Topic', [{ key: 'old-key', content: 'oldest content' }]);
        }
        return '';
      });

      const result = limitedStore.preload();
      expect(result).not.toBeNull();
      // The most recently updated topic (New Topic) should be loaded first
      expect(result).toContain('New Topic');
      expect(result).not.toContain('Old Topic');
    });

    it('persist caps project-structure entries at 200', () => {
      // Simulate existing topic with 199 entries
      const existingEntries = Array.from({ length: 199 }, (_, i) => ({
        key: `file-${i}.ts`,
        content: 'existing',
        tags: [] as string[],
      }));
      const existingTopic = makeTopicContent('Project Structure', existingEntries);

      mockedExistsSync.mockImplementation((p) => {
        const path = p as string;
        if (path.includes('project-structure.md')) return true;
        return false;
      });
      mockedReadFileSync.mockReturnValue(existingTopic);

      const input: PersistenceInput = {
        factsSnapshot: createFactsSnapshot(),
        createdFiles: ['new-file-1.ts', 'new-file-2.ts', 'new-file-3.ts'],
        errorResolutions: [],
        dependencyChanges: { installed: [], missing: [] },
        taskDescription: 'Add files',
      };

      store.persist(input);

      const writeCalls = mockedWriteFileSync.mock.calls;
      const topicWrite = writeCalls.find((c) => (c[0] as string).includes('project-structure.md'));
      expect(topicWrite).toBeDefined();
      const content = topicWrite![1] as string;
      // Count entries (### markers)
      const entryCount = (content.match(/^### /gm) || []).length;
      expect(entryCount).toBeLessThanOrEqual(200);
    });

    it('persist caps error resolutions at 50', () => {
      // Simulate existing topic with 49 errors
      const existingEntries = Array.from({ length: 49 }, (_, i) => ({
        key: `Error ${i}: msg ${i}`,
        content: `resolution ${i}`,
        tags: ['error'],
      }));
      const existingTopic = makeTopicContent('Error Resolutions', existingEntries);

      mockedExistsSync.mockImplementation((p) => {
        const path = p as string;
        if (path.includes('errors.md')) return true;
        return false;
      });
      mockedReadFileSync.mockReturnValue(existingTopic);

      const input: PersistenceInput = {
        factsSnapshot: createFactsSnapshot(),
        createdFiles: [],
        errorResolutions: [
          { errorType: 'NewError', errorMessage: 'new msg 1', resolution: 'fix 1' },
          { errorType: 'NewError', errorMessage: 'new msg 2', resolution: 'fix 2' },
          { errorType: 'NewError', errorMessage: 'new msg 3', resolution: 'fix 3' },
        ],
        dependencyChanges: { installed: [], missing: [] },
        taskDescription: 'Fix errors',
      };

      store.persist(input);

      const writeCalls = mockedWriteFileSync.mock.calls;
      const errorsWrite = writeCalls.find((c) => (c[0] as string).includes('errors.md'));
      expect(errorsWrite).toBeDefined();
      const content = errorsWrite![1] as string;
      const entryCount = (content.match(/^### /gm) || []).length;
      expect(entryCount).toBeLessThanOrEqual(50);
    });

    it('recall respects recallBudget and skips entries exceeding remaining budget', () => {
      // Store with very small recall budget
      const smallRecallStore = new MemoryStore(PROJECT_ROOT, { recallBudgetChars: 30 });

      const indexContent = makeIndexContent([
        { title: 'Patterns', id: 'patterns', summary: 'patterns' },
      ]);
      const topicContent = makeTopicContent('Patterns', [
        { key: 'src/utils/helper.ts', content: 'Short', tags: ['util'] },
        { key: 'src/utils/big.ts', content: 'x'.repeat(100), tags: ['util'] },
      ]);

      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockImplementation((p) => {
        const path = p as string;
        if (path.includes(INDEX_FILE_NAME)) return indexContent;
        return topicContent;
      });

      const results = smallRecallStore.recall({ filePath: 'src/utils/helper.ts' });
      // The big entry should be skipped because it exceeds the budget
      const bigEntry = results.find((r) => r.entryKey === 'src/utils/big.ts');
      expect(bigEntry).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // Recall and Scoring
  // -------------------------------------------------------------------------

  describe('recall and scoring', () => {
    const setupRecallStore = () => {
      const indexContent = makeIndexContent([
        { title: 'Errors', id: 'errors', summary: 'error resolutions' },
        { title: 'Patterns', id: 'patterns', summary: 'code patterns' },
      ]);
      const errorsTopic = makeTopicContent('Errors', [
        {
          key: 'TypeError in utils',
          content: 'Check null before access',
          tags: ['error', 'TypeError'],
        },
      ]);
      const patternsTopic = makeTopicContent('Patterns', [
        {
          key: 'src/components/Button.tsx',
          content: 'Use forwardRef pattern',
          tags: ['component', 'react'],
        },
        {
          key: 'src/api/client.ts',
          content: 'Always use try-catch',
          tags: ['api', 'error-handling'],
        },
      ]);

      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockImplementation((p) => {
        const path = p as string;
        if (path.includes(INDEX_FILE_NAME)) return indexContent;
        if (path.includes('errors.md')) return errorsTopic;
        if (path.includes('patterns.md')) return patternsTopic;
        return '';
      });
    };

    it('recall returns empty array when no index exists', () => {
      mockedExistsSync.mockReturnValue(false);
      const results = store.recall({ filePath: 'src/App.tsx' });
      expect(results).toEqual([]);
    });

    it('recall scores entries by file path matching', () => {
      setupRecallStore();
      const results = store.recall({ filePath: 'src/components/Button.tsx' });
      const buttonEntry = results.find((r) => r.entryKey === 'src/components/Button.tsx');
      expect(buttonEntry).toBeDefined();
      expect(buttonEntry!.score).toBeGreaterThan(0);
    });

    it('recall boosts error topic for create_file action', () => {
      setupRecallStore();
      const results = store.recall({ action: 'create_file', text: 'TypeError utils' });
      const errorEntry = results.find((r) => r.topicId === 'errors');
      expect(errorEntry).toBeDefined();
    });

    it('recall boosts patterns topic for apply_patch action', () => {
      setupRecallStore();
      const results = store.recall({ action: 'apply_patch', filePath: 'src/api/client.ts' });
      const patternEntry = results.find((r) => r.topicId === 'patterns');
      expect(patternEntry).toBeDefined();
    });

    it('recall matches by tags', () => {
      setupRecallStore();
      const results = store.recall({ tags: ['react'] });
      const reactEntry = results.find((r) => r.entryKey === 'src/components/Button.tsx');
      expect(reactEntry).toBeDefined();
      expect(reactEntry!.score).toBeGreaterThan(0);
    });

    it('recall matches by text keywords', () => {
      setupRecallStore();
      const results = store.recall({ text: 'forwardRef pattern component' });
      expect(results.length).toBeGreaterThan(0);
      const buttonEntry = results.find((r) => r.content.includes('forwardRef'));
      expect(buttonEntry).toBeDefined();
    });

    it('recall deduplicates entries already injected in this session', () => {
      setupRecallStore();

      // First recall should return results
      const first = store.recall({ filePath: 'src/components/Button.tsx' });
      const buttonFirst = first.find((r) => r.entryKey === 'src/components/Button.tsx');
      expect(buttonFirst).toBeDefined();

      // Second recall for same query should not return already-injected entries
      const second = store.recall({ filePath: 'src/components/Button.tsx' });
      const buttonSecond = second.find((r) => r.entryKey === 'src/components/Button.tsx');
      expect(buttonSecond).toBeUndefined();
    });

    it('recall results are sorted by score descending', () => {
      setupRecallStore();
      const results = store.recall({
        filePath: 'src/api/client.ts',
        action: 'apply_patch',
        tags: ['api'],
      });
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
      }
    });

    it('score is capped at 1.0', () => {
      setupRecallStore();
      // Query that would match on multiple dimensions
      const results = store.recall({
        filePath: 'src/api/client.ts',
        action: 'apply_patch',
        tags: ['api', 'error-handling'],
        text: 'try-catch api client',
      });
      for (const r of results) {
        expect(r.score).toBeLessThanOrEqual(1);
      }
    });
  });

  // -------------------------------------------------------------------------
  // Edge Cases
  // -------------------------------------------------------------------------

  describe('edge cases', () => {
    it('preload returns null when index has no topics', () => {
      const emptyIndex = makeIndexContent([]);
      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockReturnValue(emptyIndex);

      expect(store.preload()).toBeNull();
    });

    it('preload returns null when no index file exists', () => {
      mockedExistsSync.mockReturnValue(false);
      expect(store.preload()).toBeNull();
    });

    it('preload skips topics with no entries', () => {
      const indexContent = makeIndexContent([{ title: 'Empty', id: 'empty', summary: 'nothing' }]);
      const emptyTopic = makeTopicContent('Empty', []);

      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockImplementation((p) => {
        const path = p as string;
        if (path.includes(INDEX_FILE_NAME)) return indexContent;
        return emptyTopic;
      });

      expect(store.preload()).toBeNull();
    });

    it('hasMemory returns false when no index file exists', () => {
      mockedExistsSync.mockReturnValue(false);
      expect(store.hasMemory()).toBe(false);
    });

    it('hasMemory returns true when index file exists', () => {
      mockedExistsSync.mockImplementation((p) => {
        return (p as string).includes(INDEX_FILE_NAME);
      });
      expect(store.hasMemory()).toBe(true);
    });

    it('resetSession clears injected keys allowing re-recall', () => {
      const indexContent = makeIndexContent([
        { title: 'Patterns', id: 'patterns', summary: 'patterns' },
      ]);
      const topicContent = makeTopicContent('Patterns', [
        { key: 'src/App.tsx', content: 'Use memo', tags: ['component'] },
      ]);

      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockImplementation((p) => {
        const path = p as string;
        if (path.includes(INDEX_FILE_NAME)) return indexContent;
        return topicContent;
      });

      // First recall injects the entry
      const first = store.recall({ filePath: 'src/App.tsx' });
      expect(first.length).toBeGreaterThan(0);

      // After reset, same entry can be recalled again
      store.resetSession();
      const second = store.recall({ filePath: 'src/App.tsx' });
      expect(second.length).toBeGreaterThan(0);
    });

    it('persist swallows errors silently (non-blocking)', () => {
      mockedExistsSync.mockReturnValue(false);
      mockedMkdirSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const input: PersistenceInput = {
        factsSnapshot: createFactsSnapshot(),
        createdFiles: ['test.ts'],
        errorResolutions: [],
        dependencyChanges: { installed: [], missing: [] },
        taskDescription: 'test',
      };

      // Should not throw
      expect(() => store.persist(input)).not.toThrow();
    });

    it('persist with empty errorResolutions does not write errors topic', () => {
      mockedExistsSync.mockReturnValue(false);

      const input: PersistenceInput = {
        factsSnapshot: createFactsSnapshot(),
        createdFiles: [],
        errorResolutions: [],
        dependencyChanges: { installed: [], missing: [] },
        taskDescription: 'no errors',
      };

      store.persist(input);

      const writeCalls = mockedWriteFileSync.mock.calls;
      const errorsWrite = writeCalls.find((c) => (c[0] as string).includes('errors.md'));
      expect(errorsWrite).toBeUndefined();
    });

    it('inferTags correctly identifies file types from paths', () => {
      mockedExistsSync.mockReturnValue(false);

      const input: PersistenceInput = {
        factsSnapshot: createFactsSnapshot(),
        createdFiles: [
          'src/components/Button.tsx',
          'src/pages/Home.tsx',
          'src/store/auth.ts',
          'src/api/client.ts',
          'src/utils/format.ts',
          'src/App.test.ts',
          'src/styles/main.css',
        ],
        errorResolutions: [],
        dependencyChanges: { installed: [], missing: [] },
        taskDescription: 'Create files',
      };

      store.persist(input);

      const writeCalls = mockedWriteFileSync.mock.calls;
      const topicWrite = writeCalls.find((c) => (c[0] as string).includes('project-structure.md'));
      expect(topicWrite).toBeDefined();
      const content = topicWrite![1] as string;
      // Verify tags are inferred (they appear in the serialized markdown as [tags: ...])
      expect(content).toContain('[tags: component]');
      expect(content).toContain('[tags: page]');
      expect(content).toContain('[tags: store]');
      expect(content).toContain('[tags: api]');
      expect(content).toContain('[tags: util]');
      expect(content).toContain('[tags: test]');
      expect(content).toContain('[tags: style]');
    });

    it('custom memoryDir config is respected', () => {
      const customStore = new MemoryStore(PROJECT_ROOT, { memoryDir: '/custom/memory' });
      mockedExistsSync.mockReturnValue(false);
      expect(customStore.loadIndex()).toBeNull();
      expect(mockedExistsSync).toHaveBeenCalledWith(join('/custom/memory', INDEX_FILE_NAME));
    });

    it('rebuildIndex scans topics directory and writes updated index', () => {
      mockedExistsSync.mockImplementation((p) => {
        const path = p as string;
        if (path.includes(TOPICS_DIR_NAME) && !path.endsWith('.md')) return true;
        if (path.includes('topic-a.md')) return true;
        return false;
      });
      mockedReaddirSync.mockReturnValue(['topic-a.md'] as unknown as ReturnType<
        typeof readdirSync
      >);
      mockedReadFileSync.mockReturnValue(
        makeTopicContent('Topic A', [{ key: 'entry', content: 'data' }]),
      );

      const input: PersistenceInput = {
        factsSnapshot: createFactsSnapshot({
          project: { devServerRunning: false, buildStatus: 'success' },
        }),
        createdFiles: [],
        errorResolutions: [],
        dependencyChanges: { installed: [], missing: [] },
        taskDescription: 'rebuild',
      };

      store.persist(input);

      const writeCalls = mockedWriteFileSync.mock.calls;
      const indexWrite = writeCalls.find((c) => (c[0] as string).includes(INDEX_FILE_NAME));
      expect(indexWrite).toBeDefined();
      const content = indexWrite![1] as string;
      expect(content).toContain('# FrontAgent Memory');
      expect(content).toContain('topic-a');
    });
  });
});
