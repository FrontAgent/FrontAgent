import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { SnapshotManager } from './snapshot.js';

let roots: string[] = [];

function makeRoot(): string {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'snapshot-test-')));
  roots.push(root);
  return root;
}

afterEach(() => {
  for (const root of roots) {
    rmSync(root, { recursive: true, force: true });
  }
  roots = [];
});

describe('SnapshotManager.cleanup', () => {
  it('removes persisted snapshot files from disk when evicting old entries', () => {
    const root = makeRoot();
    const targetFile = join(root, 'src', 'app.ts');
    mkdirSync(join(root, 'src'), { recursive: true });
    writeFileSync(targetFile, 'v0', 'utf-8');

    const manager = new SnapshotManager(root);
    const snapshotDir = join(root, '.frontagent', 'snapshots');

    const ids: string[] = [];
    for (let i = 0; i < 5; i++) {
      writeFileSync(targetFile, `v${i}`, 'utf-8');
      ids.push(manager.createSnapshot(targetFile, 'modify'));
    }

    const filesBefore = readdirSync(snapshotDir).filter((f) => f.endsWith('.json'));
    expect(filesBefore.length).toBe(5);

    manager.cleanup(targetFile, 2);

    const filesAfter = readdirSync(snapshotDir).filter((f) => f.endsWith('.json'));
    expect(filesAfter.length).toBe(2);

    for (const removedId of ids.slice(0, 3)) {
      expect(existsSync(join(snapshotDir, `${removedId}.json`))).toBe(false);
    }
    for (const keptId of ids.slice(3)) {
      expect(existsSync(join(snapshotDir, `${keptId}.json`))).toBe(true);
    }
  });

  it('is a no-op when file has fewer snapshots than keepCount', () => {
    const root = makeRoot();
    const targetFile = join(root, 'file.ts');
    writeFileSync(targetFile, 'content', 'utf-8');

    const manager = new SnapshotManager(root);
    manager.createSnapshot(targetFile, 'modify');

    const snapshotDir = join(root, '.frontagent', 'snapshots');
    const filesBefore = readdirSync(snapshotDir).filter((f) => f.endsWith('.json'));

    manager.cleanup(targetFile, 10);

    const filesAfter = readdirSync(snapshotDir).filter((f) => f.endsWith('.json'));
    expect(filesAfter.length).toBe(filesBefore.length);
  });
});
