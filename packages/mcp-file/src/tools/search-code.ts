/**
 * search_code 工具
 * 在代码库中搜索
 */

import { readFileSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { escapeRegex } from '@frontagent/shared';
import { glob } from 'glob';
import { getRealProjectRoot, isInsidePath, isUnsafeGlobPattern } from '../path-safety.js';

export interface SearchCodeParams {
  query?: string;
  pattern?: string;
  filePattern?: string;
  globOnly?: boolean;
  maxResults?: number;
  contextLines?: number;
}

export interface SearchMatch {
  file: string;
  line: number;
  column: number;
  content: string;
  context?: {
    before: string[];
    after: string[];
  };
}

export interface SearchCodeResult {
  success: boolean;
  files?: string[];
  totalFiles?: number;
  matches?: SearchMatch[];
  totalMatches?: number;
  truncated?: boolean;
  error?: string;
}

/**
 * 搜索代码
 */
export async function searchCode(
  params: SearchCodeParams,
  projectRoot: string,
): Promise<SearchCodeResult> {
  const defaultFilePattern = '**/*.{ts,tsx,js,jsx,json,yaml,yml,md,css,scss,html,vue,svelte}';
  const {
    query,
    pattern,
    filePattern = defaultFilePattern,
    globOnly = false,
    maxResults = 100,
    contextLines = 2,
  } = params;
  const effectiveFilePattern = filePattern.trim() || defaultFilePattern;
  const effectiveMaxResults = maxResults > 0 ? maxResults : 100;

  if (!query && !pattern && !globOnly) {
    return {
      success: false,
      error: 'Either query, pattern, or globOnly must be provided',
    };
  }

  try {
    if (isUnsafeGlobPattern(effectiveFilePattern)) {
      return {
        success: false,
        error: 'Unsafe filePattern: glob patterns must stay inside the project root',
      };
    }

    const realProjectRoot = getRealProjectRoot(projectRoot);
    // 使用 glob 查找文件
    const files = await glob(effectiveFilePattern, {
      cwd: realProjectRoot,
      nodir: true,
      ignore: ['**/node_modules/**', '**/dist/**', '**/.git/**', '**/coverage/**'],
    });
    const safeFiles = files.filter((file) =>
      isInsidePath(resolve(realProjectRoot, file), realProjectRoot),
    );

    if (globOnly) {
      return {
        success: true,
        files: safeFiles.slice(0, effectiveMaxResults),
        totalFiles: safeFiles.length,
        truncated: safeFiles.length > effectiveMaxResults,
      };
    }

    const matches: SearchMatch[] = [];
    const searchRegex = pattern ? new RegExp(pattern, 'gi') : new RegExp(escapeRegex(query!), 'gi');

    for (const file of safeFiles) {
      if (matches.length >= effectiveMaxResults) {
        break;
      }

      const fullPath = resolve(realProjectRoot, file);

      // 跳过太大的文件
      const stat = statSync(fullPath);
      if (stat.size > 1024 * 1024) {
        // 1MB
        continue;
      }

      try {
        const content = readFileSync(fullPath, 'utf-8');
        const lines = content.split('\n');

        for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
          if (matches.length >= effectiveMaxResults) {
            break;
          }

          const line = lines[lineIdx];
          let match;
          searchRegex.lastIndex = 0;

          while ((match = searchRegex.exec(line)) !== null) {
            // 零宽匹配（如 pattern 为 `a*`、`(?=x)`）不会推进 lastIndex，
            // 手动前移避免死循环；空匹配本身没有可展示的内容，直接跳过
            if (match[0].length === 0) {
              searchRegex.lastIndex++;
              continue;
            }

            const searchMatch: SearchMatch = {
              file: relative(realProjectRoot, fullPath),
              line: lineIdx + 1,
              column: match.index + 1,
              content: line.trim(),
            };

            // 添加上下文
            if (contextLines > 0) {
              const beforeStart = Math.max(0, lineIdx - contextLines);
              const afterEnd = Math.min(lines.length, lineIdx + contextLines + 1);

              searchMatch.context = {
                before: lines.slice(beforeStart, lineIdx).map((l) => l.trim()),
                after: lines.slice(lineIdx + 1, afterEnd).map((l) => l.trim()),
              };
            }

            matches.push(searchMatch);

            if (matches.length >= effectiveMaxResults) {
              break;
            }
          }
        }
      } catch {
        // File read failed (e.g. binary file, permission denied) — skip silently
      }
    }

    return {
      success: true,
      matches,
      totalMatches: matches.length,
      truncated: matches.length >= effectiveMaxResults,
    };
  } catch (error) {
    return {
      success: false,
      error: `Search failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * 工具的 JSON Schema 定义
 */
export const searchCodeSchema = {
  name: 'search_code',
  description: '在代码库中搜索文本或正则表达式。返回匹配的行及其上下文。',
  inputSchema: {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: '要搜索的文本（会进行精确匹配）',
      },
      pattern: {
        type: 'string',
        description: '正则表达式模式（优先于 query）',
      },
      filePattern: {
        type: 'string',
        description: '文件 glob 模式，默认搜索常见代码文件',
        default: '**/*.{ts,tsx,js,jsx,json,yaml,yml,md,css,scss,html,vue,svelte}',
      },
      globOnly: {
        type: 'boolean',
        description: '仅执行 glob 文件发现，不搜索文件内容。用于写入前先收集候选路径。',
        default: false,
      },
      maxResults: {
        type: 'number',
        description: '最大返回结果数，默认 100',
        default: 100,
      },
      contextLines: {
        type: 'number',
        description: '每个匹配显示的上下文行数，默认 2',
        default: 2,
      },
    },
    required: [],
  },
};
