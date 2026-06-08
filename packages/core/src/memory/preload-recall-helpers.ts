import type { OpenMemoryGatewayRecord } from './open-memory-gateway.js';
import type { MemoryTopic, RecalledMemory } from './types.js';

export const PRELOAD_HEADER = '## 项目记忆 (跨会话持久化)';

export interface BuildPreloadInput {
  budget: number;
  maxTopicFiles: number;
  gatewayMemories: OpenMemoryGatewayRecord[];
  topics: Iterable<MemoryTopic>;
}

export interface RecallBudgetSelection {
  results: RecalledMemory[];
  injectedKeys: string[];
}

export function buildPreload(input: BuildPreloadInput): string | null {
  const parts: string[] = [PRELOAD_HEADER];
  let charCount = measurePreloadParts(parts);

  const gatewaySection = renderGatewayForPreload(input.gatewayMemories, input.budget);
  if (gatewaySection && charCount < input.budget) {
    parts.push(gatewaySection);
    charCount = measurePreloadParts(parts);
  }

  const topicIterator = input.topics[Symbol.iterator]();
  let loaded = 0;
  while (loaded < input.maxTopicFiles && charCount < input.budget) {
    const nextTopic = topicIterator.next();
    if (nextTopic.done) break;
    const topic = nextTopic.value;
    if (topic.entries.length === 0) continue;

    const section = renderTopicForPreload(topic);
    const sectionLength = section.length + sectionSeparatorLength(parts);
    if (charCount + sectionLength > input.budget) {
      const remaining = input.budget - charCount - sectionSeparatorLength(parts);
      if (remaining > 200) {
        parts.push(truncatePreloadSection(section, remaining));
      }
      break;
    }

    parts.push(section);
    charCount = measurePreloadParts(parts);
    loaded++;
  }

  return parts.length > 1 ? parts.join('\n\n') : null;
}

export function selectRecallResultsWithinBudget(
  candidates: RecalledMemory[],
  budget: number,
): RecallBudgetSelection {
  const results: RecalledMemory[] = [];
  const injectedKeys: string[] = [];
  let remaining = budget;

  for (const candidate of candidates) {
    if (remaining <= 0) break;
    if (candidate.content.length > remaining) continue;

    results.push(candidate);
    remaining -= candidate.content.length;
    injectedKeys.push(`${candidate.topicId}::${candidate.entryKey}`);
  }

  return { results, injectedKeys };
}

function renderGatewayForPreload(
  memories: OpenMemoryGatewayRecord[],
  preloadBudget: number,
): string | null {
  if (memories.length === 0) return null;

  const lines: string[] = [];
  const title = '## Open Memory Gateway Active Memories';
  const marker = '\n...(truncated)';
  const remainingBudget = remainingPreloadBudgetAfterHeader(preloadBudget);
  let charCount = 0;

  if (title.length > remainingBudget) {
    return null;
  }

  lines.push(title);
  charCount = title.length;
  for (const memory of memories) {
    const line = `- **${memory.id}**: ${memory.content}`;
    const lineLength = line.length + 1;
    const remaining = remainingBudget - charCount - 1;

    if (charCount + lineLength <= remainingBudget) {
      lines.push(line);
      charCount += lineLength;
      continue;
    }

    if (remaining > marker.length) {
      lines.push(truncatePreloadSection(line, remaining));
    }
    break;
  }
  return lines.join('\n');
}

function remainingPreloadBudgetAfterHeader(preloadBudget: number): number {
  return preloadBudget - PRELOAD_HEADER.length - 2;
}

function renderTopicForPreload(topic: MemoryTopic): string {
  const lines: string[] = [`### ${topic.meta.title}`];
  for (const entry of topic.entries) {
    lines.push(`- **${entry.key}**: ${entry.content}`);
  }
  return lines.join('\n');
}

function measurePreloadParts(parts: string[]): number {
  return parts.join('\n\n').length;
}

function sectionSeparatorLength(parts: string[]): number {
  return parts.length > 0 ? 2 : 0;
}

function truncatePreloadSection(section: string, budget: number): string {
  const marker = '\n...(truncated)';
  if (budget <= marker.length) {
    return section.slice(0, Math.max(0, budget));
  }
  return `${section.slice(0, budget - marker.length)}${marker}`;
}
