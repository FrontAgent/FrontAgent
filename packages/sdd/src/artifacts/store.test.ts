import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { FileArtifactStore } from './store.js';
import type { Artifact } from './types.js';

let roots: string[] = [];

function makeRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'artifact-store-'));
  roots.push(root);
  return root;
}

function makeArtifact(overrides: Partial<Artifact> = {}): Artifact {
  return {
    id: 'art-1',
    type: 'spec',
    changeId: 'change-001',
    version: 1,
    status: 'active',
    content: '# Spec\n\nSome content here.',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

afterEach(() => {
  for (const root of roots) {
    rmSync(root, { recursive: true, force: true });
  }
  roots = [];
});

describe('FileArtifactStore', () => {
  it('creates active and archive directories on construction', () => {
    const root = makeRoot();
    new FileArtifactStore(root);
    expect(existsSync(join(root, 'active'))).toBe(true);
    expect(existsSync(join(root, 'archive'))).toBe(true);
  });

  describe('save', () => {
    it('writes content and meta to active directory', async () => {
      const root = makeRoot();
      const store = new FileArtifactStore(root);
      const artifact = makeArtifact();

      await store.save(artifact);

      const contentPath = join(root, 'active', 'change-001', 'spec.md');
      const metaPath = join(root, 'active', 'change-001', 'spec.meta.json');
      expect(existsSync(contentPath)).toBe(true);
      expect(existsSync(metaPath)).toBe(true);
      expect(readFileSync(contentPath, 'utf-8')).toBe('# Spec\n\nSome content here.');
      const meta = JSON.parse(readFileSync(metaPath, 'utf-8'));
      expect(meta.id).toBe('art-1');
      expect(meta.type).toBe('spec');
      expect(meta.status).toBe('active');
    });

    it('writes archived artifacts to archive directory', async () => {
      const root = makeRoot();
      const store = new FileArtifactStore(root);
      const artifact = makeArtifact({ status: 'archived' });

      await store.save(artifact);

      expect(existsSync(join(root, 'archive', 'change-001', 'spec.md'))).toBe(true);
      expect(existsSync(join(root, 'active', 'change-001', 'spec.md'))).toBe(false);
    });

    it('overwrites existing artifact on re-save', async () => {
      const root = makeRoot();
      const store = new FileArtifactStore(root);
      await store.save(makeArtifact({ content: 'v1' }));
      await store.save(makeArtifact({ content: 'v2', version: 2 }));

      const content = readFileSync(join(root, 'active', 'change-001', 'spec.md'), 'utf-8');
      expect(content).toBe('v2');
    });
  });

  describe('load', () => {
    it('loads a saved artifact with content', async () => {
      const root = makeRoot();
      const store = new FileArtifactStore(root);
      await store.save(makeArtifact());

      const loaded = await store.load('change-001', 'spec');
      expect(loaded).not.toBeNull();
      expect(loaded!.content).toBe('# Spec\n\nSome content here.');
      expect(loaded!.id).toBe('art-1');
    });

    it('returns null for non-existent changeId', async () => {
      const root = makeRoot();
      const store = new FileArtifactStore(root);

      const loaded = await store.load('missing', 'spec');
      expect(loaded).toBeNull();
    });

    it('returns null for non-existent type', async () => {
      const root = makeRoot();
      const store = new FileArtifactStore(root);
      await store.save(makeArtifact());

      const loaded = await store.load('change-001', 'proposal');
      expect(loaded).toBeNull();
    });
  });

  describe('loadMeta', () => {
    it('loads meta without content', async () => {
      const root = makeRoot();
      const store = new FileArtifactStore(root);
      await store.save(makeArtifact());

      const meta = await store.loadMeta('change-001', 'spec');
      expect(meta).not.toBeNull();
      expect(meta!.id).toBe('art-1');
      expect((meta as unknown as Record<string, unknown>).content).toBeUndefined();
    });

    it('finds meta in archive if not in active', async () => {
      const root = makeRoot();
      const store = new FileArtifactStore(root);
      await store.save(makeArtifact({ status: 'archived' }));

      const meta = await store.loadMeta('change-001', 'spec');
      expect(meta).not.toBeNull();
      expect(meta!.status).toBe('archived');
    });

    it('returns null for missing meta', async () => {
      const root = makeRoot();
      const store = new FileArtifactStore(root);

      const meta = await store.loadMeta('missing', 'spec');
      expect(meta).toBeNull();
    });
  });

  describe('list', () => {
    it('lists all artifacts for a changeId', async () => {
      const root = makeRoot();
      const store = new FileArtifactStore(root);
      await store.save(makeArtifact({ type: 'spec', id: 'art-1' }));
      await store.save(makeArtifact({ type: 'design', id: 'art-2' }));

      const refs = await store.list('change-001');
      expect(refs).toHaveLength(2);
      expect(refs.map((r) => r.type).sort()).toEqual(['design', 'spec']);
    });

    it('returns empty array for non-existent changeId', async () => {
      const root = makeRoot();
      const store = new FileArtifactStore(root);

      const refs = await store.list('missing');
      expect(refs).toEqual([]);
    });

    it('includes artifacts from both active and archive', async () => {
      const root = makeRoot();
      const store = new FileArtifactStore(root);
      await store.save(makeArtifact({ type: 'spec', status: 'active' }));
      await store.save(makeArtifact({ type: 'design', status: 'archived' }));

      const refs = await store.list('change-001');
      expect(refs).toHaveLength(2);
    });
  });

  describe('listActive', () => {
    it('lists active changeIds', async () => {
      const root = makeRoot();
      const store = new FileArtifactStore(root);
      await store.save(makeArtifact({ changeId: 'c1' }));
      await store.save(makeArtifact({ changeId: 'c2' }));

      const active = await store.listActive();
      expect(active.sort()).toEqual(['c1', 'c2']);
    });

    it('returns empty array when no active artifacts', async () => {
      const root = makeRoot();
      const store = new FileArtifactStore(root);

      const active = await store.listActive();
      expect(active).toEqual([]);
    });
  });

  describe('archive', () => {
    it('moves artifacts from active to archive', async () => {
      const root = makeRoot();
      const store = new FileArtifactStore(root);
      await store.save(makeArtifact());

      await store.archive('change-001');

      expect(existsSync(join(root, 'active', 'change-001'))).toBe(false);
      expect(existsSync(join(root, 'archive', 'change-001', 'spec.md'))).toBe(true);
    });

    it('updates meta status to archived', async () => {
      const root = makeRoot();
      const store = new FileArtifactStore(root);
      await store.save(makeArtifact());

      await store.archive('change-001');

      const metaPath = join(root, 'archive', 'change-001', 'spec.meta.json');
      const meta = JSON.parse(readFileSync(metaPath, 'utf-8'));
      expect(meta.status).toBe('archived');
    });

    it('is a no-op for non-existent changeId', async () => {
      const root = makeRoot();
      const store = new FileArtifactStore(root);

      await expect(store.archive('missing')).resolves.toBeUndefined();
    });
  });

  describe('listArchived', () => {
    it('lists archived changeIds', async () => {
      const root = makeRoot();
      const store = new FileArtifactStore(root);
      await store.save(makeArtifact({ changeId: 'c1' }));
      await store.save(makeArtifact({ changeId: 'c2' }));
      await store.archive('c1');
      await store.archive('c2');

      const archived = await store.listArchived();
      expect(archived.sort()).toEqual(['c1', 'c2']);
    });

    it('returns empty array when no archived artifacts', async () => {
      const root = makeRoot();
      const store = new FileArtifactStore(root);

      const archived = await store.listArchived();
      expect(archived).toEqual([]);
    });
  });
});
