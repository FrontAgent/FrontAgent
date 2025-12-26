/**
 * search_code 工具
 * 在代码库中搜索
 */

import { readFileSync, statSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { glob } from 'glob';

export interface SearchCodeParams {
  query?: string;
  pattern?: string;
  filePattern?: string;
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
  projectRoot: string
): Promise<SearchCodeResult> {
  const {
    query,
    pattern,
    filePattern = '**/*.{ts,tsx,js,jsx,json,yaml,yml,md,css,scss,html,vue,svelte}',
    maxResults = 100,
    contextLines = 2
  } = params;

  if (!query && !pattern) {
    return {
      success: false,
      error: 'Either query or pattern must be provided'
    };
  }

  try {
    // 使用 glob 查找文件
    const files = await glob(filePattern, {
      cwd: projectRoot,
      nodir: true,
      ignore: ['**/node_modules/**', '**/dist/**', '**/.git/**', '**/coverage/**']
    });

    const matches: SearchMatch[] = [];
    const searchRegex = pattern
      ? new RegExp(pattern, 'gi')
      : new RegExp(escapeRegex(query!), 'gi');

    for (const file of files) {
      if (matches.length >= maxResults) {
        break;
      }

      const fullPath = resolve(projectRoot, file);
      
      // 跳过太大的文件
      const stat = statSync(fullPath);
      if (stat.size > 1024 * 1024) { // 1MB
        continue;
      }

      try {
        const content = readFileSync(fullPath, 'utf-8');
        const lines = content.split('\n');

        for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
          if (matches.length >= maxResults) {
            break;
          }

          const line = lines[lineIdx];
          let match;
          searchRegex.lastIndex = 0;

          while ((match = searchRegex.exec(line)) !== null) {
            const searchMatch: SearchMatch = {
              file: relative(projectRoot, fullPath),
              line: lineIdx + 1,
              column: match.index + 1,
              content: line.trim()
            };

            // 添加上下文
            if (contextLines > 0) {
              const beforeStart = Math.max(0, lineIdx - contextLines);
              const afterEnd = Math.min(lines.length, lineIdx + contextLines + 1);
              
              searchMatch.context = {
                before: lines.slice(beforeStart, lineIdx).map(l => l.trim()),
                after: lines.slice(lineIdx + 1, afterEnd).map(l => l.trim())
              };
            }

            matches.push(searchMatch);

            if (matches.length >= maxResults) {
              break;
            }
          }
        }
      } catch {
        // 跳过无法读取的文件
        continue;
      }
    }

    return {
      success: true,
      matches,
      totalMatches: matches.length,
      truncated: matches.length >= maxResults
    };
  } catch (error) {
    return {
      success: false,
      error: `Search failed: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * 转义正则特殊字符
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
        description: '要搜索的文本（会进行精确匹配）'
      },
      pattern: {
        type: 'string',
        description: '正则表达式模式（优先于 query）'
      },
      filePattern: {
        type: 'string',
        description: '文件 glob 模式，默认搜索常见代码文件',
        default: '**/*.{ts,tsx,js,jsx,json,yaml,yml,md,css,scss,html,vue,svelte}'
      },
      maxResults: {
        type: 'number',
        description: '最大返回结果数，默认 100',
        default: 100
      },
      contextLines: {
        type: 'number',
        description: '每个匹配显示的上下文行数，默认 2',
        default: 2
      }
    },
    required: []
  }
};

