import { describe, expect, it } from 'vitest';
import type { Message } from '../types.js';
import {
  applyZoneBudgets,
  compactMessageHistory,
  isCompactedSummaryMessage,
  type PromptZone,
  truncateWithMarker,
} from './budget.js';

describe('truncateWithMarker', () => {
  it('returns content unchanged when within budget', () => {
    expect(truncateWithMarker('short', 100, 'rules')).toBe('short');
  });

  it('truncates over-budget content with a visible marker and stays within budget', () => {
    const result = truncateWithMarker('x'.repeat(500), 300, 'memory');
    expect(result).toContain('[已截断：memory zone 超出 300 字符预算]');
    expect(result.length).toBeLessThanOrEqual(300);
    expect(result.startsWith('xxx')).toBe(true);
  });
});

describe('applyZoneBudgets', () => {
  function zones(sizes: Partial<Record<PromptZone['name'], number>>): PromptZone[] {
    return Object.entries(sizes).map(([name, size]) => ({
      name: name as PromptZone['name'],
      content: name[0].repeat(size as number),
    }));
  }

  it('applies independent per-zone budgets with markers', () => {
    const result = applyZoneBudgets(zones({ rules: 100, memory: 500 }), {
      zoneBudgets: { rules: 1000, memory: 300 },
    });
    expect(result[0].content).toBe('r'.repeat(100));
    expect(result[1].content).toContain('[已截断：memory zone 超出 300 字符预算]');
  });

  it('shrinks lower-priority zones first when the total budget competes', () => {
    const result = applyZoneBudgets(zones({ rules: 1000, memory: 1000, context: 1000 }), {
      zoneBudgets: { rules: 5000, memory: 5000, context: 5000 },
      totalBudget: 2400,
    });
    const byName = Object.fromEntries(result.map((zone) => [zone.name, zone.content]));
    expect(byName.context).toContain('[已截断：context zone');
    expect(byName.rules).toBe('r'.repeat(1000));
    expect(byName.memory).toBe('m'.repeat(1000));
  });

  it('keeps shrinking into higher-priority zones only when needed', () => {
    const result = applyZoneBudgets(zones({ rules: 1000, memory: 1000, context: 1000 }), {
      zoneBudgets: { rules: 5000, memory: 5000, context: 5000 },
      totalBudget: 1500,
    });
    const byName = Object.fromEntries(result.map((zone) => [zone.name, zone.content]));
    expect(byName.context).toContain('[已截断：context zone');
    expect(byName.memory).toContain('[已截断：memory zone');
    expect(byName.rules).toBe('r'.repeat(1000));
  });
});

describe('compactMessageHistory', () => {
  function makeMessages(count: number, leadingSystem = 2): Message[] {
    const messages: Message[] = [];
    for (let i = 0; i < leadingSystem; i++) {
      messages.push({ role: 'system', content: `system prompt ${i}` });
    }
    for (let i = 0; i < count; i++) {
      messages.push({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `message ${i}`,
      });
    }
    return messages;
  }

  it('does nothing below the threshold', () => {
    const messages = makeMessages(5);
    const result = compactMessageHistory(messages, { threshold: 10, keepRecent: 3 });
    expect(result.compacted).toBe(false);
    expect(result.messages).toBe(messages);
  });

  it('compacts middle messages while preserving leading system messages and recent turns', () => {
    const messages = makeMessages(30, 2);
    const result = compactMessageHistory(messages, { threshold: 20, keepRecent: 5 });

    expect(result.compacted).toBe(true);
    expect(result.messages[0].content).toBe('system prompt 0');
    expect(result.messages[1].content).toBe('system prompt 1');
    expect(isCompactedSummaryMessage(result.messages[2])).toBe(true);
    expect(result.messages[2].content).toContain(`[已压缩 ${result.compactedCount} 条消息]`);
    expect(result.messages.slice(3)).toHaveLength(5);
    expect(result.messages.at(-1)?.content).toBe('message 29');
  });

  it('re-compacts an already compacted history without losing the recent tail', () => {
    const first = compactMessageHistory(makeMessages(30, 1), { threshold: 10, keepRecent: 5 });
    const grown = [
      ...first.messages,
      ...Array.from({ length: 10 }, (_, i) => ({
        role: 'user' as const,
        content: `late message ${i}`,
      })),
    ];
    const second = compactMessageHistory(grown, { threshold: 10, keepRecent: 5 });

    expect(second.compacted).toBe(true);
    expect(second.messages.at(-1)?.content).toBe('late message 9');
    expect(second.messages[0].content).toBe('system prompt 0');
  });
});
