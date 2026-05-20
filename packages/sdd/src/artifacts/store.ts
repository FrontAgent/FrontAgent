/**
 * 文件系统 Artifact 存储实现
 *
 * 目录结构:
 *   {root}/active/{changeId}/{type}.md
 *   {root}/active/{changeId}/{type}.meta.json
 *   {root}/archive/{changeId}/...
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import type { Artifact, ArtifactMeta, ArtifactRef, ArtifactStore, ArtifactType } from './types.js';

export class FileArtifactStore implements ArtifactStore {
  private root: string;

  constructor(root: string) {
    this.root = root;
    mkdirSync(join(this.root, 'active'), { recursive: true });
    mkdirSync(join(this.root, 'archive'), { recursive: true });
  }

  async save(artifact: Artifact): Promise<void> {
    const dir =
      artifact.status === 'archived'
        ? join(this.root, 'archive', artifact.changeId)
        : join(this.root, 'active', artifact.changeId);

    mkdirSync(dir, { recursive: true });

    const contentPath = join(dir, `${artifact.type}.md`);
    writeFileSync(contentPath, artifact.content, 'utf-8');

    const meta: ArtifactMeta = {
      id: artifact.id,
      type: artifact.type,
      changeId: artifact.changeId,
      version: artifact.version,
      status: artifact.status,
      schema: artifact.schema,
      createdAt: artifact.createdAt,
      updatedAt: artifact.updatedAt,
    };
    const metaPath = join(dir, `${artifact.type}.meta.json`);
    writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
  }

  async load(changeId: string, type: ArtifactType): Promise<Artifact | null> {
    const meta = await this.loadMeta(changeId, type);
    if (!meta) return null;

    const dir =
      meta.status === 'archived'
        ? join(this.root, 'archive', changeId)
        : join(this.root, 'active', changeId);

    const contentPath = join(dir, `${type}.md`);
    if (!existsSync(contentPath)) return null;

    const content = readFileSync(contentPath, 'utf-8');
    return { ...meta, content };
  }

  async loadMeta(changeId: string, type: ArtifactType): Promise<ArtifactMeta | null> {
    for (const sub of ['active', 'archive']) {
      const metaPath = join(this.root, sub, changeId, `${type}.meta.json`);
      if (existsSync(metaPath)) {
        try {
          return JSON.parse(readFileSync(metaPath, 'utf-8')) as ArtifactMeta;
        } catch {
          return null;
        }
      }
    }
    return null;
  }

  async list(changeId: string): Promise<ArtifactRef[]> {
    const refs: ArtifactRef[] = [];
    for (const sub of ['active', 'archive']) {
      const dir = join(this.root, sub, changeId);
      if (!existsSync(dir)) continue;

      const files = readdirSync(dir).filter((f) => f.endsWith('.meta.json'));
      for (const file of files) {
        try {
          const meta = JSON.parse(readFileSync(join(dir, file), 'utf-8')) as ArtifactMeta;
          refs.push({
            id: meta.id,
            type: meta.type,
            path: join(sub, changeId, `${meta.type}.md`),
          });
        } catch {
          // skip malformed meta
        }
      }
    }
    return refs;
  }

  async listActive(): Promise<string[]> {
    const activeDir = join(this.root, 'active');
    if (!existsSync(activeDir)) return [];
    return readdirSync(activeDir).filter((entry) => {
      const full = join(activeDir, entry);
      return statSync(full).isDirectory();
    });
  }

  async archive(changeId: string): Promise<void> {
    const src = join(this.root, 'active', changeId);
    if (!existsSync(src)) return;

    const dest = join(this.root, 'archive', changeId);
    mkdirSync(join(this.root, 'archive'), { recursive: true });
    renameSync(src, dest);

    // Update meta files to reflect archived status
    const metaFiles = readdirSync(dest).filter((f) => f.endsWith('.meta.json'));
    for (const file of metaFiles) {
      const metaPath = join(dest, file);
      try {
        const meta = JSON.parse(readFileSync(metaPath, 'utf-8')) as ArtifactMeta;
        meta.status = 'archived';
        meta.updatedAt = new Date().toISOString();
        writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
      } catch {
        // skip
      }
    }
  }

  async listArchived(): Promise<string[]> {
    const archiveDir = join(this.root, 'archive');
    if (!existsSync(archiveDir)) return [];
    return readdirSync(archiveDir).filter((entry) => {
      const full = join(archiveDir, entry);
      return statSync(full).isDirectory();
    });
  }
}

export function createFileArtifactStore(root: string): FileArtifactStore {
  return new FileArtifactStore(root);
}
