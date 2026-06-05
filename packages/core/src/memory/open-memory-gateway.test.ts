import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { OpenMemoryGatewayAdapter } from './open-memory-gateway.js';
import type { OpenMemoryGatewayConfig } from './types.js';

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'frontagent-omg-'));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('OpenMemoryGatewayAdapter', () => {
  it('writes draft captures to the Open Memory Gateway inbox contract', () => {
    const adapter = new OpenMemoryGatewayAdapter({ rootDir: root, captureSource: 'frontagent' });

    const record = adapter.captureDraft({
      content: 'Remember that this repository prefers TDD.',
      tags: ['FrontAgent', 'TDD'],
    });

    expect(record.id).toMatch(/^mem_\d{8}_[a-f0-9]{8}$/);
    expect(record.status).toBe('draft');
    expect(record.source).toBe('frontagent');
    expect(record.tags).toEqual(['frontagent', 'tdd']);
    expect(record.path).toBe(join(root, 'memory', 'inbox', `${record.id}.md`));

    const active = adapter.listActive();
    expect(active).toEqual([]);
  });

  it('lists only active memories from the gateway active directory', async () => {
    const activeDir = join(root, 'memory', 'active');
    const inboxDir = join(root, 'memory', 'inbox');
    await mkdir(activeDir, { recursive: true });
    await mkdir(inboxDir, { recursive: true });
    await writeFile(
      join(activeDir, 'mem_20260605_active123.md'),
      [
        '---',
        'id: mem_20260605_active123',
        'status: active',
        'scope: personal',
        'source: manual',
        'tags:',
        '  - preference',
        'createdAt: "2026-06-05T09:00:00.000Z"',
        'updatedAt: "2026-06-05T09:01:00.000Z"',
        '---',
        'Prefer small focused adapters.',
        '',
      ].join('\n'),
      'utf-8',
    );
    await writeFile(
      join(inboxDir, 'mem_20260605_draft123.md'),
      [
        '---',
        'id: mem_20260605_draft123',
        'status: draft',
        'scope: personal',
        'source: manual',
        'tags: []',
        'createdAt: "2026-06-05T09:00:00.000Z"',
        'updatedAt: "2026-06-05T09:01:00.000Z"',
        '---',
        'This draft should not preload.',
        '',
      ].join('\n'),
      'utf-8',
    );

    const adapter = new OpenMemoryGatewayAdapter({ rootDir: root });

    expect(adapter.listActive()).toMatchObject([
      {
        id: 'mem_20260605_active123',
        status: 'active',
        tags: ['preference'],
        content: 'Prefer small focused adapters.',
      },
    ]);
  });

  it('ignores malformed gateway files while listing active memories', async () => {
    const activeDir = join(root, 'memory', 'active');
    await mkdir(activeDir, { recursive: true });
    await writeFile(join(activeDir, 'broken.md'), 'not frontmatter', 'utf-8');
    await writeFile(
      join(activeDir, 'mem_20260605_good123.md'),
      [
        '---',
        'id: mem_20260605_good123',
        'status: active',
        'scope: personal',
        'source: manual',
        'tags: []',
        'createdAt: "2026-06-05T09:00:00.000Z"',
        'updatedAt: "2026-06-05T09:01:00.000Z"',
        '---',
        'Valid active memory.',
        '',
      ].join('\n'),
      'utf-8',
    );

    const adapter = new OpenMemoryGatewayAdapter({ rootDir: root });

    expect(adapter.listActive()).toHaveLength(1);
    expect(adapter.listActive()[0].content).toBe('Valid active memory.');
  });

  it('documents the public gateway config field names', () => {
    const config = {
      enabled: true,
      rootDir: root,
      captureSource: 'frontagent',
      autoApprove: false,
    } satisfies OpenMemoryGatewayConfig;

    expect(config).toEqual({
      enabled: true,
      rootDir: root,
      captureSource: 'frontagent',
      autoApprove: false,
    });
  });
});
