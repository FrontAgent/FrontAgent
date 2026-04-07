import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  readdirSync,
} from 'node:fs';
import { join, basename } from 'node:path';
import type { ProjectFactsSnapshot } from '../types.js';
import type {
  MemoryConfig,
  MemoryIndex,
  MemoryTopicMeta,
  MemoryTopic,
  MemoryEntry,
  PersistenceInput,
  RecallQuery,
  RecalledMemory,
} from './types.js';
import {
  MEMORY_INDEX_VERSION,
  DEFAULT_PRELOAD_BUDGET_CHARS,
  DEFAULT_RECALL_BUDGET_CHARS,
  DEFAULT_MAX_TOPIC_FILES,
  MEMORY_DIR_NAME,
  TOPICS_DIR_NAME,
  SNAPSHOTS_DIR_NAME,
  INDEX_FILE_NAME,
  FACTS_SNAPSHOT_FILE_NAME,
} from './types.js';

/**
 * Durable memory store backed by human-readable Markdown files and JSON snapshots.
 * All writes funnel through this class (single-writer pattern).
 */
export class MemoryStore {
  private readonly memoryDir: string;
  private readonly topicsDir: string;
  private readonly snapshotsDir: string;
  private readonly preloadBudget: number;
  private readonly recallBudget: number;
  private readonly maxTopicFiles: number;

  private index: MemoryIndex | null = null;
  private topicCache: Map<string, MemoryTopic> = new Map();

  /** Track which entries have been injected in this session to avoid duplicates */
  private injectedKeys: Set<string> = new Set();

  constructor(projectRoot: string, config?: MemoryConfig) {
    this.memoryDir = config?.memoryDir ?? join(projectRoot, MEMORY_DIR_NAME);
    this.topicsDir = join(this.memoryDir, TOPICS_DIR_NAME);
    this.snapshotsDir = join(this.memoryDir, SNAPSHOTS_DIR_NAME);
    this.preloadBudget = config?.preloadBudgetChars ?? DEFAULT_PRELOAD_BUDGET_CHARS;
    this.recallBudget = config?.recallBudgetChars ?? DEFAULT_RECALL_BUDGET_CHARS;
    this.maxTopicFiles = config?.maxTopicFiles ?? DEFAULT_MAX_TOPIC_FILES;
  }

  // ---------------------------------------------------------------------------
  // Directory bootstrapping
  // ---------------------------------------------------------------------------

  private ensureDirs(): void {
    for (const dir of [this.memoryDir, this.topicsDir, this.snapshotsDir]) {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Index I/O
  // ---------------------------------------------------------------------------

  loadIndex(): MemoryIndex | null {
    const indexPath = join(this.memoryDir, INDEX_FILE_NAME);
    if (!existsSync(indexPath)) {
      return null;
    }

    try {
      const raw = readFileSync(indexPath, 'utf-8');
      return this.parseIndex(raw);
    } catch {
      return null;
    }
  }

  private parseIndex(raw: string): MemoryIndex {
    const topics: MemoryTopicMeta[] = [];

    const lines = raw.split('\n');
    let projectRoot = '';

    for (const line of lines) {
      const projMatch = line.match(/^Project:\s*`(.+)`/);
      if (projMatch) {
        projectRoot = projMatch[1];
        continue;
      }

      // Parse topic lines: - [Title](topics/id.md) — summary (updated: ISO, ~NNN chars)
      const topicMatch = line.match(
        /^- \[(.+?)]\(topics\/(.+?)\.md\)\s*[—–-]\s*(.+?)(?:\s*\(updated:\s*(.+?),\s*~(\d+)\s*chars\))?\s*$/
      );
      if (topicMatch) {
        topics.push({
          title: topicMatch[1],
          id: topicMatch[2],
          summary: topicMatch[3].trim(),
          updatedAt: topicMatch[4] ?? new Date().toISOString(),
          charCount: topicMatch[5] ? parseInt(topicMatch[5], 10) : 0,
        });
      }
    }

    return {
      version: MEMORY_INDEX_VERSION,
      projectRoot,
      updatedAt: new Date().toISOString(),
      topics,
    };
  }

  private serializeIndex(index: MemoryIndex): string {
    const lines: string[] = [
      '# FrontAgent Memory',
      '',
      `Project: \`${index.projectRoot}\``,
      `Updated: ${index.updatedAt}`,
      '',
      '## Topics',
      '',
    ];

    for (const topic of index.topics) {
      lines.push(
        `- [${topic.title}](topics/${topic.id}.md) — ${topic.summary} (updated: ${topic.updatedAt}, ~${topic.charCount} chars)`
      );
    }

    lines.push('');
    return lines.join('\n');
  }

  private writeIndex(index: MemoryIndex): void {
    this.ensureDirs();
    const indexPath = join(this.memoryDir, INDEX_FILE_NAME);
    writeFileSync(indexPath, this.serializeIndex(index), 'utf-8');
    this.index = index;
  }

  // ---------------------------------------------------------------------------
  // Topic I/O
  // ---------------------------------------------------------------------------

  loadTopic(topicId: string): MemoryTopic | null {
    if (this.topicCache.has(topicId)) {
      return this.topicCache.get(topicId)!;
    }

    const topicPath = join(this.topicsDir, `${topicId}.md`);
    if (!existsSync(topicPath)) {
      return null;
    }

    try {
      const raw = readFileSync(topicPath, 'utf-8');
      const topic = this.parseTopic(topicId, raw);
      this.topicCache.set(topicId, topic);
      return topic;
    } catch {
      return null;
    }
  }

  private parseTopic(topicId: string, raw: string): MemoryTopic {
    const entries: MemoryEntry[] = [];
    const lines = raw.split('\n');
    let title = topicId;
    let currentEntry: Partial<MemoryEntry> | null = null;
    let contentLines: string[] = [];

    for (const line of lines) {
      // Parse title from first H1
      const titleMatch = line.match(/^# (.+)/);
      if (titleMatch && entries.length === 0 && !currentEntry) {
        title = titleMatch[1];
        continue;
      }

      // Each H3 starts a new entry: ### key [tags: a, b] (updated: ISO)
      const entryMatch = line.match(
        /^### (.+?)(?:\s*\[tags:\s*(.+?)])?\s*(?:\(updated:\s*(.+?)\))?\s*$/
      );
      if (entryMatch) {
        if (currentEntry?.key) {
          currentEntry.content = contentLines.join('\n').trim();
          entries.push(currentEntry as MemoryEntry);
        }
        currentEntry = {
          key: entryMatch[1].trim(),
          tags: entryMatch[2] ? entryMatch[2].split(',').map((t) => t.trim()) : [],
          updatedAt: entryMatch[3] ?? new Date().toISOString(),
        };
        contentLines = [];
        continue;
      }

      if (currentEntry) {
        contentLines.push(line);
      }
    }

    if (currentEntry?.key) {
      currentEntry.content = contentLines.join('\n').trim();
      entries.push(currentEntry as MemoryEntry);
    }

    return {
      meta: {
        id: topicId,
        title,
        summary: entries.length > 0 ? `${entries.length} entries` : 'empty',
        updatedAt: new Date().toISOString(),
        charCount: raw.length,
      },
      entries,
    };
  }

  private serializeTopic(topic: MemoryTopic): string {
    const lines: string[] = [`# ${topic.meta.title}`, ''];

    for (const entry of topic.entries) {
      const tagsStr = entry.tags.length > 0 ? ` [tags: ${entry.tags.join(', ')}]` : '';
      lines.push(`### ${entry.key}${tagsStr} (updated: ${entry.updatedAt})`);
      lines.push('');
      lines.push(entry.content);
      lines.push('');
    }

    return lines.join('\n');
  }

  private writeTopic(topic: MemoryTopic): void {
    this.ensureDirs();
    const content = this.serializeTopic(topic);
    topic.meta.charCount = content.length;
    topic.meta.updatedAt = new Date().toISOString();
    const topicPath = join(this.topicsDir, `${topic.meta.id}.md`);
    writeFileSync(topicPath, content, 'utf-8');
    this.topicCache.set(topic.meta.id, topic);
  }

  // ---------------------------------------------------------------------------
  // Facts Snapshot I/O
  // ---------------------------------------------------------------------------

  loadFactsSnapshot(): ProjectFactsSnapshot | null {
    const snapshotPath = join(this.snapshotsDir, FACTS_SNAPSHOT_FILE_NAME);
    if (!existsSync(snapshotPath)) {
      return null;
    }

    try {
      const raw = readFileSync(snapshotPath, 'utf-8');
      return JSON.parse(raw) as ProjectFactsSnapshot;
    } catch {
      return null;
    }
  }

  writeFactsSnapshot(snapshot: ProjectFactsSnapshot): void {
    this.ensureDirs();
    const snapshotPath = join(this.snapshotsDir, FACTS_SNAPSHOT_FILE_NAME);
    writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2), 'utf-8');
  }

  // ---------------------------------------------------------------------------
  // Startup Preload (Phase 1)
  // ---------------------------------------------------------------------------

  /**
   * Load memory for injection at startup. Returns a structured string
   * within the configured budget.
   */
  preload(): string | null {
    const index = this.loadIndex();
    if (!index || index.topics.length === 0) {
      return null;
    }
    this.index = index;

    const parts: string[] = ['## 项目记忆 (跨会话持久化)'];
    let charCount = parts[0].length;

    // Load topic files within budget
    const sortedTopics = [...index.topics].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

    let loaded = 0;
    for (const topicMeta of sortedTopics) {
      if (loaded >= this.maxTopicFiles) break;
      if (charCount >= this.preloadBudget) break;

      const topic = this.loadTopic(topicMeta.id);
      if (!topic || topic.entries.length === 0) continue;

      const section = this.renderTopicForPreload(topic);
      if (charCount + section.length > this.preloadBudget) {
        // Try to include a truncated version
        const remaining = this.preloadBudget - charCount;
        if (remaining > 200) {
          parts.push(section.slice(0, remaining) + '\n...(truncated)');
          charCount = this.preloadBudget;
        }
        break;
      }

      parts.push(section);
      charCount += section.length;
      loaded++;
    }

    return parts.length > 1 ? parts.join('\n\n') : null;
  }

  private renderTopicForPreload(topic: MemoryTopic): string {
    const lines: string[] = [`### ${topic.meta.title}`];
    for (const entry of topic.entries) {
      lines.push(`- **${entry.key}**: ${entry.content}`);
    }
    return lines.join('\n');
  }

  // ---------------------------------------------------------------------------
  // Runtime Recall (Phase 2)
  // ---------------------------------------------------------------------------

  /**
   * Recall relevant memories for a specific code-generation context.
   * Returns entries within the recall budget, excluding already-injected ones.
   */
  recall(query: RecallQuery): RecalledMemory[] {
    const index = this.index ?? this.loadIndex();
    if (!index || index.topics.length === 0) {
      return [];
    }

    const candidates: RecalledMemory[] = [];

    for (const topicMeta of index.topics) {
      const topic = this.loadTopic(topicMeta.id);
      if (!topic) continue;

      for (const entry of topic.entries) {
        const dedupKey = `${topicMeta.id}::${entry.key}`;
        if (this.injectedKeys.has(dedupKey)) continue;

        const score = this.scoreEntry(entry, topicMeta.id, query);
        if (score > 0) {
          candidates.push({
            topicId: topicMeta.id,
            entryKey: entry.key,
            content: entry.content,
            score,
          });
        }
      }
    }

    candidates.sort((a, b) => b.score - a.score);

    const results: RecalledMemory[] = [];
    let budget = this.recallBudget;

    for (const candidate of candidates) {
      if (budget <= 0) break;
      if (candidate.content.length > budget) continue;

      results.push(candidate);
      budget -= candidate.content.length;

      const dedupKey = `${candidate.topicId}::${candidate.entryKey}`;
      this.injectedKeys.add(dedupKey);
    }

    return results;
  }

  /**
   * Score an entry's relevance to a recall query.
   * Simple keyword/path matching — no embeddings needed for this tier.
   */
  private scoreEntry(
    entry: MemoryEntry,
    topicId: string,
    query: RecallQuery
  ): number {
    let score = 0;

    // File path matching: if the entry key or tags reference the queried path
    if (query.filePath) {
      const pathLower = query.filePath.toLowerCase();
      if (entry.key.toLowerCase().includes(pathLower)) {
        score += 0.8;
      }
      // Check if any component of the path matches tags
      const pathParts = pathLower.split('/');
      for (const tag of entry.tags) {
        if (pathParts.some((part) => part.includes(tag.toLowerCase()))) {
          score += 0.3;
        }
      }
      // Check if the entry content mentions the file path
      if (entry.content.toLowerCase().includes(pathLower)) {
        score += 0.2;
      }
    }

    // Error topic gets a boost when the action involves code generation
    if (topicId === 'errors' && (query.action === 'create_file' || query.action === 'apply_patch')) {
      score += 0.2;
    }

    // Pattern topic gets a boost for code generation actions
    if (topicId === 'patterns' && (query.action === 'create_file' || query.action === 'apply_patch')) {
      score += 0.15;
    }

    // Tag matching
    if (query.tags) {
      for (const queryTag of query.tags) {
        if (entry.tags.some((t) => t.toLowerCase() === queryTag.toLowerCase())) {
          score += 0.4;
        }
      }
    }

    // Text matching (simple keyword overlap)
    if (query.text) {
      const queryWords = query.text.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
      const contentLower = (entry.content + ' ' + entry.key).toLowerCase();
      let matches = 0;
      for (const word of queryWords) {
        if (contentLower.includes(word)) {
          matches++;
        }
      }
      if (queryWords.length > 0) {
        score += (matches / queryWords.length) * 0.5;
      }
    }

    return Math.min(score, 1);
  }

  // ---------------------------------------------------------------------------
  // Post-Task Persistence (Phase 3)
  // ---------------------------------------------------------------------------

  /**
   * Persist durable learnings after a task completes.
   * Runs off the critical path — callers should fire-and-forget.
   */
  persist(input: PersistenceInput): void {
    try {
      this.ensureDirs();

      // 1. Write facts snapshot
      this.writeFactsSnapshot(input.factsSnapshot);

      // 2. Update project-structure topic from facts
      this.persistProjectStructure(input);

      // 3. Update dependencies topic
      this.persistDependencies(input);

      // 4. Update errors topic
      this.persistErrors(input);

      // 5. Rebuild index
      this.rebuildIndex(input.factsSnapshot);
    } catch (error) {
      // Non-blocking: swallow errors to avoid disrupting the main task
      if (process.env.DEBUG) {
        console.warn('[MemoryStore] Persistence failed:', error);
      }
    }
  }

  private persistProjectStructure(input: PersistenceInput): void {
    const topicId = 'project-structure';
    const existing = this.loadTopic(topicId);
    const entries: MemoryEntry[] = existing?.entries.slice() ?? [];
    const now = new Date().toISOString();

    // Add newly created files
    for (const filePath of input.createdFiles) {
      const existingEntry = entries.find((e) => e.key === filePath);
      if (existingEntry) {
        existingEntry.updatedAt = now;
        continue;
      }
      entries.push({
        key: filePath,
        content: `File created during task: "${input.taskDescription}"`,
        updatedAt: now,
        tags: this.inferTags(filePath),
      });
    }

    // Cap entries to prevent unbounded growth
    const capped = entries.slice(-200);

    this.writeTopic({
      meta: {
        id: topicId,
        title: 'Project Structure',
        summary: `${capped.length} tracked files`,
        updatedAt: now,
        charCount: 0,
      },
      entries: capped,
    });
  }

  private persistDependencies(input: PersistenceInput): void {
    const topicId = 'dependencies';
    const existing = this.loadTopic(topicId);
    const entries: MemoryEntry[] = existing?.entries.slice() ?? [];
    const now = new Date().toISOString();

    for (const pkg of input.dependencyChanges.installed) {
      const existingEntry = entries.find((e) => e.key === pkg);
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
      const existingEntry = entries.find((e) => e.key === pkg);
      if (!existingEntry) {
        entries.push({
          key: pkg,
          content: 'Known missing dependency',
          updatedAt: now,
          tags: ['dependency', 'missing'],
        });
      }
    }

    if (entries.length > 0) {
      this.writeTopic({
        meta: {
          id: topicId,
          title: 'Dependencies',
          summary: `${entries.length} tracked packages`,
          updatedAt: now,
          charCount: 0,
        },
        entries,
      });
    }
  }

  private persistErrors(input: PersistenceInput): void {
    if (input.errorResolutions.length === 0) return;

    const topicId = 'errors';
    const existing = this.loadTopic(topicId);
    const entries: MemoryEntry[] = existing?.entries.slice() ?? [];
    const now = new Date().toISOString();

    for (const resolution of input.errorResolutions) {
      const key = `${resolution.errorType}: ${resolution.errorMessage}`.slice(0, 120);
      const existingEntry = entries.find((e) => e.key === key);

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

    // Keep only the most recent 50 error resolutions
    const capped = entries.slice(-50);

    this.writeTopic({
      meta: {
        id: topicId,
        title: 'Error Resolutions',
        summary: `${capped.length} recorded resolutions`,
        updatedAt: now,
        charCount: 0,
      },
      entries: capped,
    });
  }

  private rebuildIndex(snapshot: ProjectFactsSnapshot): void {
    const now = new Date().toISOString();
    const topics: MemoryTopicMeta[] = [];

    // Scan the topics directory for all topic files
    if (existsSync(this.topicsDir)) {
      const files = readdirSync(this.topicsDir).filter((f) => f.endsWith('.md'));
      for (const file of files) {
        const topicId = basename(file, '.md');
        const topic = this.loadTopic(topicId);
        if (topic) {
          topics.push(topic.meta);
        }
      }
    }

    const index: MemoryIndex = {
      version: MEMORY_INDEX_VERSION,
      projectRoot: snapshot.project.buildStatus ? '(from snapshot)' : '',
      updatedAt: now,
      topics,
    };

    this.writeIndex(index);
  }

  private inferTags(filePath: string): string[] {
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

  // ---------------------------------------------------------------------------
  // Session lifecycle
  // ---------------------------------------------------------------------------

  /** Reset per-session dedup tracking. Call at the start of each task. */
  resetSession(): void {
    this.injectedKeys.clear();
  }

  /** Check whether any memory exists on disk */
  hasMemory(): boolean {
    const indexPath = join(this.memoryDir, INDEX_FILE_NAME);
    return existsSync(indexPath);
  }
}
