/**
 * read_file 工具
 * 读取指定文件的内容
 */

import { readFileSync, statSync } from 'node:fs';
import { extname } from 'node:path';
import { resolveReadPath } from '../path-safety.js';

export interface ReadFileParams {
  path: string;
  encoding?: BufferEncoding;
  startLine?: number;
  endLine?: number;
}

export interface ReadFileResult {
  success: boolean;
  content?: string;
  lines?: number;
  language?: string;
  size?: number;
  error?: string;
}

/**
 * 根据文件扩展名推断语言
 */
function detectLanguage(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  const languageMap: Record<string, string> = {
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.json': 'json',
    '.yaml': 'yaml',
    '.yml': 'yaml',
    '.md': 'markdown',
    '.css': 'css',
    '.scss': 'scss',
    '.less': 'less',
    '.html': 'html',
    '.vue': 'vue',
    '.svelte': 'svelte',
    '.py': 'python',
    '.go': 'go',
    '.rs': 'rust',
    '.java': 'java',
    '.kt': 'kotlin',
    '.swift': 'swift',
    '.rb': 'ruby',
    '.php': 'php',
    '.sh': 'shell',
    '.bash': 'shell',
    '.zsh': 'shell',
    '.sql': 'sql',
    '.graphql': 'graphql',
    '.gql': 'graphql',
  };

  return languageMap[ext] ?? 'plaintext';
}

/**
 * 执行文件读取
 */
export function readFile(params: ReadFileParams, projectRoot: string): ReadFileResult {
  const { path: filePath, encoding = 'utf-8', startLine, endLine } = params;

  const safePath = resolveReadPath(filePath, projectRoot);
  if (!safePath.ok) {
    return {
      success: false,
      error: safePath.error,
    };
  }

  // 检查是否是文件
  const stat = statSync(safePath.fullPath);
  if (!stat.isFile()) {
    return {
      success: false,
      error: `Not a file: ${filePath}`,
    };
  }

  try {
    let content = readFileSync(safePath.fullPath, encoding);
    const allLines = content.split('\n');
    let lines = allLines.length;

    // 如果指定了行范围，截取内容
    if (startLine !== undefined || endLine !== undefined) {
      const start = startLine ?? 1;
      const end = endLine ?? allLines.length;

      if (!Number.isInteger(start) || start < 1) {
        return {
          success: false,
          error: `Invalid startLine: ${start} (must be an integer >= 1)`,
        };
      }
      if (start > allLines.length) {
        return {
          success: false,
          error: `startLine ${start} exceeds file length (${allLines.length} lines)`,
        };
      }
      if (!Number.isInteger(end) || end < start) {
        return {
          success: false,
          error: `Invalid endLine: ${end} (must be an integer >= startLine)`,
        };
      }

      const selected = allLines.slice(start - 1, end);
      content = selected.join('\n');
      lines = selected.length;
    }

    return {
      success: true,
      content,
      lines,
      language: detectLanguage(safePath.fullPath),
      size: stat.size,
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to read file: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * 工具的 JSON Schema 定义
 */
export const readFileSchema = {
  name: 'read_file',
  description: '读取指定文件的内容。支持指定行范围。',
  inputSchema: {
    type: 'object' as const,
    properties: {
      path: {
        type: 'string',
        description: '相对于项目根目录的文件路径',
      },
      encoding: {
        type: 'string',
        description: '文件编码，默认 utf-8',
        default: 'utf-8',
      },
      startLine: {
        type: 'number',
        description: '起始行号（1-based），可选',
      },
      endLine: {
        type: 'number',
        description: '结束行号（1-based，包含），可选',
      },
    },
    required: ['path'],
  },
};
