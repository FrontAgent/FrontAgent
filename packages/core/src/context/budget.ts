import type { Message } from '../types.js';

/**
 * 上下文预算与历史压缩
 *
 * 系统提示词的每个 zone 有独立字符预算，超出部分截断并附显式标记；
 * 当各 zone 预算后总量仍超过 totalBudget 时，按 rules > memory >
 * filesense > context 的优先级从低到高继续收缩。消息历史超过阈值时
 * 把较早的消息压缩为一条摘要，事实(facts)不经过消息历史，不受影响。
 */

export type PromptZoneName = 'rules' | 'memory' | 'filesense' | 'context';

export interface ZoneBudgets {
  rules?: number;
  memory?: number;
  filesense?: number;
  context?: number;
}

export interface HistoryCompactionConfig {
  /** 触发压缩的消息数阈值 */
  threshold?: number;
  /** 压缩时保留的最近消息数 */
  keepRecent?: number;
}

export interface ContextBudgetConfig {
  /** 各 zone 的字符预算 */
  zoneBudgets?: ZoneBudgets;
  /** 可选总预算；预算竞争时低优先级 zone 先收缩 */
  totalBudget?: number;
  /** 消息历史压缩配置 */
  historyCompaction?: HistoryCompactionConfig;
}

export const DEFAULT_ZONE_BUDGETS: Required<ZoneBudgets> = {
  rules: 32_000,
  memory: 16_000,
  filesense: 8_000,
  context: 16_000,
};

export const DEFAULT_HISTORY_THRESHOLD = 40;
export const DEFAULT_HISTORY_KEEP_RECENT = 12;

/** zone 收缩顺序：低优先级在前 */
const ZONE_SHRINK_ORDER: PromptZoneName[] = ['context', 'filesense', 'memory', 'rules'];

/** 预算装不下完整标记时使用的简短标记 */
const SHORT_TRUNCATION_MARKER = '[已截断]';

/**
 * 截断到预算内并附可见标记。后置条件：返回值长度恒 <= max(budget, 0)；
 * 预算装不下完整标记时退化为简短标记，预算更小则只保留裁剪内容。
 */
export function truncateWithMarker(content: string, budget: number, zoneName: string): string {
  if (content.length <= budget) return content;
  if (budget <= 0) return '';

  const marker = `\n[已截断：${zoneName} zone 超出 ${budget} 字符预算]`;
  if (budget > marker.length) {
    return `${content.slice(0, budget - marker.length)}${marker}`;
  }
  if (budget > SHORT_TRUNCATION_MARKER.length) {
    return `${content.slice(0, budget - SHORT_TRUNCATION_MARKER.length)}${SHORT_TRUNCATION_MARKER}`;
  }
  return content.slice(0, budget);
}

export interface PromptZone {
  name: PromptZoneName;
  content: string;
}

/**
 * 应用 zone 预算：先按各 zone 独立预算截断，再在总预算下按优先级收缩。
 * totalBudget 约束的是最终序列化结果——zone 间的拼接分隔符成本
 * （separatorLength * (zones - 1)）计入总量。
 */
export function applyZoneBudgets(
  zones: PromptZone[],
  config?: ContextBudgetConfig,
  separatorLength = 1,
): PromptZone[] {
  const budgets = { ...DEFAULT_ZONE_BUDGETS, ...config?.zoneBudgets };

  let result = zones.map((zone) => ({
    ...zone,
    content: truncateWithMarker(zone.content, budgets[zone.name], zone.name),
  }));

  const totalBudget = config?.totalBudget;
  if (totalBudget === undefined) return result;

  const separatorCost = Math.max(zones.length - 1, 0) * separatorLength;

  for (const shrinkTarget of ZONE_SHRINK_ORDER) {
    const total = result.reduce((sum, zone) => sum + zone.content.length, 0) + separatorCost;
    if (total <= totalBudget) break;

    const overflow = total - totalBudget;
    result = result.map((zone) => {
      if (zone.name !== shrinkTarget) return zone;
      const target = Math.max(zone.content.length - overflow, 0);
      return { ...zone, content: truncateWithMarker(zone.content, target, zone.name) };
    });
  }

  return result;
}

const COMPACTED_SUMMARY_HEADER = '## 历史消息摘要 (compacted)';
const SUMMARY_LINE_MAX_CHARS = 100;
const SUMMARY_MAX_LINES = 40;

export function isCompactedSummaryMessage(message: Message): boolean {
  return message.role === 'system' && message.content.startsWith(COMPACTED_SUMMARY_HEADER);
}

export interface CompactionResult {
  messages: Message[];
  compacted: boolean;
  compactedCount: number;
}

/**
 * 压缩消息历史：保留开头的 system 消息和最近 keepRecent 条，
 * 中间的消息折叠为一条确定性的摘要 system 消息
 */
export function compactMessageHistory(
  messages: Message[],
  config?: HistoryCompactionConfig,
): CompactionResult {
  const threshold = config?.threshold ?? DEFAULT_HISTORY_THRESHOLD;
  const keepRecent = config?.keepRecent ?? DEFAULT_HISTORY_KEEP_RECENT;

  if (messages.length <= threshold) {
    return { messages, compacted: false, compactedCount: 0 };
  }

  // 开头连续的 system 消息（SDD 约束、constitution）必须原样保留；
  // 历史压缩生成的 summary 不算受保护头部，会被纳入下一轮重新汇总，
  // 保证任意时刻最多只有一条 summary
  let headEnd = 0;
  while (
    headEnd < messages.length &&
    messages[headEnd].role === 'system' &&
    !isCompactedSummaryMessage(messages[headEnd])
  ) {
    headEnd += 1;
  }

  const tailStart = Math.max(messages.length - keepRecent, headEnd);
  const middle = messages.slice(headEnd, tailStart);
  if (middle.length === 0) {
    return { messages, compacted: false, compactedCount: 0 };
  }

  const summaryLines: string[] = [COMPACTED_SUMMARY_HEADER, `[已压缩 ${middle.length} 条消息]`];
  for (const message of middle.slice(0, SUMMARY_MAX_LINES)) {
    const firstLine = message.content.split('\n', 1)[0];
    const snippet =
      firstLine.length > SUMMARY_LINE_MAX_CHARS
        ? `${firstLine.slice(0, SUMMARY_LINE_MAX_CHARS)}...`
        : firstLine;
    summaryLines.push(`- (${message.role}) ${snippet}`);
  }
  if (middle.length > SUMMARY_MAX_LINES) {
    summaryLines.push(`- …等 ${middle.length - SUMMARY_MAX_LINES} 条`);
  }

  const summaryMessage: Message = { role: 'system', content: summaryLines.join('\n') };

  return {
    messages: [...messages.slice(0, headEnd), summaryMessage, ...messages.slice(tailStart)],
    compacted: true,
    compactedCount: middle.length,
  };
}
