import { z } from 'zod';

export interface RetrievedRagContext {
  formattedResults: string[];
  matches: RagContextMatchInternal[];
  searchMode?: 'hybrid' | 'keyword_only' | 'openviking' | 'composite';
  reranked?: boolean;
  warnings?: string[];
  timing?: import('../types.js').RagQueryTiming;
}

export interface RagContextMatchInternal {
  type: string;
  title: string;
  sourceUrl: string;
  snippet: string;
  path?: string;
  score?: number;
  rerankScore?: number;
}

export const ragQueryRewriteSchema = z.object({
  searchQuery: z.string().min(1),
});

export const FRONTAGENT_IDENTITY_CONTEXT = [
  '我是 FrontAgent，一个面向前端工程的 AI 编码智能体，也可以理解为前端领域编码专家。',
  '我的核心能力是理解现有前端项目结构，结合 SDD、知识库和当前工作区上下文，进行规划、编码、调试、重构和验证。',
  '我的工作方式是先观察再操作，通过可审计的工具调用逐步缩小不确定性，并尽量给出可以落地的工程结果。',
].join('\n');

export function truncateForPrompt(input: string, maxLength: number): string {
  if (input.length <= maxLength) {
    return input;
  }
  return `${input.slice(0, maxLength)}\n...`;
}

export function normalizeSearchQuery(input: string): string {
  return input
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^["'`“”]+|["'`“”]+$/g, '')
    .trim();
}

export function mergeRetrievalQuery(originalQuery: string, rewrittenQuery: string): string {
  const original = normalizeSearchQuery(originalQuery);
  const rewritten = normalizeSearchQuery(rewrittenQuery);

  if (!rewritten) {
    return original;
  }

  if (!original) {
    return rewritten;
  }

  if (rewritten.includes(original)) {
    return rewritten;
  }

  if (original.includes(rewritten)) {
    return original;
  }

  const merged = `${original} ${rewritten}`.trim();
  return merged.length > 320 ? merged.slice(0, 320).trim() : merged;
}
