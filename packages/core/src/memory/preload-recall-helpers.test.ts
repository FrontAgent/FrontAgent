import { describe, expect, it } from 'vitest';
import type { OpenMemoryGatewayRecord } from './open-memory-gateway.js';
import {
  buildPreload,
  PRELOAD_HEADER,
  selectRecallResultsWithinBudget,
} from './preload-recall-helpers.js';
import type { MemoryTopic, RecalledMemory } from './types.js';

function makeTopic(
  overrides: Partial<MemoryTopic['meta']>,
  entries: MemoryTopic['entries'],
): MemoryTopic {
  return {
    meta: {
      id: 'patterns',
      title: 'Patterns',
      summary: 'patterns',
      updatedAt: '2024-01-01T00:00:00.000Z',
      charCount: 0,
      ...overrides,
    },
    entries,
  };
}

function makeGatewayMemory(overrides: Partial<OpenMemoryGatewayRecord>): OpenMemoryGatewayRecord {
  return {
    id: 'mem_20240101_active123',
    status: 'active',
    scope: 'personal',
    source: 'manual',
    tags: [],
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    content: 'Gateway active memory content.',
    path: '/gateway/memory/active/mem_20240101_active123.md',
    ...overrides,
  };
}

describe('memory preload and recall helpers', () => {
  it('builds preload with gateway memories before local topics', () => {
    const topic = makeTopic({ title: 'Patterns' }, [
      {
        key: 'src/App.tsx',
        content: 'Use memo for expensive computed props.',
        updatedAt: '2024-01-01T00:00:00.000Z',
        tags: ['react'],
      },
    ]);
    const gatewayMemory = makeGatewayMemory({
      id: 'mem_1',
      tags: ['preference'],
      updatedAt: '2024-01-02T00:00:00.000Z',
      content: 'Preserve compact editor controls.',
    });

    const preload = buildPreload({
      budget: 800,
      maxTopicFiles: 10,
      gatewayMemories: [gatewayMemory],
      topics: [topic],
    });

    expect(preload).toContain(PRELOAD_HEADER);
    expect(preload).toContain('## Open Memory Gateway Active Memories');
    expect(preload).toContain('Preserve compact editor controls.');
    expect(preload).toContain('### Patterns');
    expect(preload).toContain('- **src/App.tsx**: Use memo for expensive computed props.');
    expect(preload!.indexOf('Preserve compact editor controls.')).toBeLessThan(
      preload!.indexOf('Use memo for expensive computed props.'),
    );
  });

  it('truncates preload content to the configured budget', () => {
    const preload = buildPreload({
      budget: 120,
      maxTopicFiles: 10,
      gatewayMemories: [
        makeGatewayMemory({
          id: 'mem_long',
          content: 'Gateway active memory content. '.repeat(20),
        }),
      ],
      topics: [],
    });

    expect(preload).not.toBeNull();
    expect(preload!.length).toBeLessThanOrEqual(120);
    expect(preload).toContain('...(truncated)');
  });

  it('returns null when no gateway memories or topic entries are available', () => {
    const preload = buildPreload({
      budget: 800,
      maxTopicFiles: 10,
      gatewayMemories: [],
      topics: [makeTopic({ title: 'Empty' }, [])],
    });

    expect(preload).toBeNull();
  });

  it('selects recall results within budget and reports injected keys', () => {
    const candidates: RecalledMemory[] = [
      { topicId: 'patterns', entryKey: 'small', content: 'Short content', score: 0.9 },
      { topicId: 'patterns', entryKey: 'large', content: 'x'.repeat(100), score: 0.8 },
    ];

    const selected = selectRecallResultsWithinBudget(candidates, 20);

    expect(selected.results).toEqual([candidates[0]]);
    expect(selected.injectedKeys).toEqual(['patterns::small']);
  });
});
