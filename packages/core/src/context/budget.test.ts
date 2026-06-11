import { describe, expect, it } from 'vitest';
import type { Message } from '../types.js';
import {
  applyZoneBudgets,
  compactMessageHistory,
  isCompactedSummaryMessage,
  type PromptZone,
  serializeZones,
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

  it('never exceeds tiny budgets that cannot fit the full marker', () => {
    const fullMarkerLength = '\n[已截断：memory zone 超出 30 字符预算]'.length;
    expect(fullMarkerLength).toBeGreaterThan(20);

    const small = truncateWithMarker('x'.repeat(500), 20, 'memory');
    expect(small.length).toBeLessThanOrEqual(20);
    expect(small).toContain('[已截断]');

    const tiny = truncateWithMarker('x'.repeat(500), 3, 'memory');
    expect(tiny.length).toBeLessThanOrEqual(3);

    expect(truncateWithMarker('x'.repeat(500), 0, 'memory')).toBe('');
    expect(truncateWithMarker('x'.repeat(500), -5, 'memory')).toBe('');
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

  function totalLength(result: PromptZone[]): number {
    return result.reduce((sum, zone) => sum + zone.content.length, 0);
  }

  it('shrinks lower-priority zones first when the total budget competes', () => {
    const result = applyZoneBudgets(zones({ rules: 1000, memory: 1000, context: 1000 }), {
      zoneBudgets: { rules: 5000, memory: 5000, context: 5000 },
      totalBudget: 2400,
    });
    const byName = Object.fromEntries(result.map((zone) => [zone.name, zone.content]));
    expect(byName.context).toContain('[已截断：context zone');
    expect(byName.rules).toBe('r'.repeat(1000));
    expect(byName.memory).toBe('m'.repeat(1000));
    expect(totalLength(result)).toBeLessThanOrEqual(2400);
  });

  it('keeps shrinking into higher-priority zones only when needed', () => {
    const result = applyZoneBudgets(zones({ rules: 1000, memory: 1000, context: 1000 }), {
      zoneBudgets: { rules: 5000, memory: 5000, context: 5000 },
      totalBudget: 1500,
    });
    const byName = Object.fromEntries(result.map((zone) => [zone.name, zone.content]));
    // 极限收缩下 context 先被清空，memory 再被截断，rules 最后保留
    expect(byName.context).toBe('');
    expect(byName.memory).toContain('[已截断：memory zone');
    expect(byName.rules).toBe('r'.repeat(1000));
    expect(totalLength(result)).toBeLessThanOrEqual(1500);
  });

  it('stays within an extremely small total budget by squeezing all zones', () => {
    const result = applyZoneBudgets(zones({ rules: 1000, memory: 1000, context: 1000 }), {
      zoneBudgets: { rules: 5000, memory: 5000, context: 5000 },
      totalBudget: 100,
    });
    expect(totalLength(result)).toBeLessThanOrEqual(100);
  });

  it('counts join separators against the total budget', () => {
    const result = applyZoneBudgets(zones({ rules: 800, memory: 800, context: 800 }), {
      zoneBudgets: { rules: 5000, memory: 5000, context: 5000 },
      totalBudget: 2000,
    });
    // totalBudget 约束最终序列化结果，包括 zone 之间的 '\n' 分隔符
    expect(serializeZones(result).length).toBeLessThanOrEqual(2000);
  });

  it('converges below a total budget smaller than the separator cost', () => {
    const input = zones({ rules: 1000, instructions: 1000, memory: 1000, context: 1000 });
    const config = {
      zoneBudgets: { rules: 5000, instructions: 5000, memory: 5000, context: 5000 },
    };

    // 4 个 zone、3 个分隔符：totalBudget 小于分隔符总成本时，
    // 空 zone 不参与序列化，最终结果仍收敛在预算内
    for (const totalBudget of [2, 1, 0]) {
      const result = applyZoneBudgets(input, { ...config, totalBudget });
      expect(serializeZones(result).length).toBeLessThanOrEqual(totalBudget);
    }
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

  it('keeps at most one summary and a bounded length across many compaction rounds', () => {
    const options = { threshold: 10, keepRecent: 5 };
    let messages = makeMessages(30, 2);

    for (let round = 0; round < 10; round++) {
      const result = compactMessageHistory(messages, options);
      messages = [
        ...result.messages,
        ...Array.from({ length: 8 }, (_, i) => ({
          role: 'user' as const,
          content: `round ${round} message ${i}`,
        })),
      ];
    }
    const final = compactMessageHistory(messages, options);

    const summaries = final.messages.filter((message) => isCompactedSummaryMessage(message));
    expect(summaries).toHaveLength(1);
    // head(2) + summary(1) + keepRecent(5)
    expect(final.messages.length).toBe(8);
    expect(final.messages[0].content).toBe('system prompt 0');
    expect(final.messages[1].content).toBe('system prompt 1');
  });
});
