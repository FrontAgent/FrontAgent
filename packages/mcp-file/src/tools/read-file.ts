/**
 * read_file 工具
 * 读取指定文件的内容
 */

import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, extname } from 'node:path';

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
    '.gql': 'graphql'
  };

  return languageMap[ext] ?? 'plaintext';
}

/**
 * 执行文件读取
 */
export function readFile(params: ReadFileParams, projectRoot: string): ReadFileResult {
  const { path: filePath, encoding = 'utf-8', startLine, endLine } = params;

  // 解析完整路径
  const fullPath = resolve(projectRoot, filePath);

  // 安全检查：确保路径在项目根目录内
  if (!fullPath.startsWith(projectRoot)) {
    return {
      success: false,
      error: `Access denied: Path is outside project root`
    };
  }

  // 检查文件是否存在
  if (!existsSync(fullPath)) {
    return {
      success: false,
      error: `File not found: ${filePath}`
    };
  }

  // 检查是否是文件
  const stat = statSync(fullPath);
  if (!stat.isFile()) {
    return {
      success: false,
      error: `Not a file: ${filePath}`
    };
  }

  try {
    let content = readFileSync(fullPath, encoding);
    const allLines = content.split('\n');
    let lines = allLines.length;

    // 如果指定了行范围，截取内容
    if (startLine !== undefined || endLine !== undefined) {
      const start = (startLine ?? 1) - 1; // 转为 0-based
      const end = endLine ?? allLines.length;
      content = allLines.slice(start, end).join('\n');
      lines = end - start;
    }

    return {
      success: true,
      content,
      lines,
      language: detectLanguage(fullPath),
      size: stat.size
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to read file: ${error instanceof Error ? error.message : String(error)}`
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
        description: '相对于项目根目录的文件路径'
      },
      encoding: {
        type: 'string',
        description: '文件编码，默认 utf-8',
        default: 'utf-8'
      },
      startLine: {
        type: 'number',
        description: '起始行号（1-based），可选'
      },
      endLine: {
        type: 'number',
        description: '结束行号（1-based，包含），可选'
      }
    },
    required: ['path']
  }
};

