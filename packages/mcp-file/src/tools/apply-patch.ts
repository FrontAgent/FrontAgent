/**
 * apply_patch 工具
 * 应用最小化代码补丁
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { mkdirSync } from 'node:fs';
import * as Diff from 'diff';
import type { FilePatch, PatchResult } from '@frontagent/shared';
import type { SnapshotManager } from '../snapshot.js';

export interface ApplyPatchParams {
  path: string;
  patches: FilePatch[];
  dryRun?: boolean;
}

/**
 * 应用补丁
 */
export function applyPatch(
  params: ApplyPatchParams,
  projectRoot: string,
  snapshotManager: SnapshotManager
): PatchResult {
  const { path: filePath, patches, dryRun = false } = params;

  // 解析完整路径
  const fullPath = resolve(projectRoot, filePath);

  // 安全检查
  if (!fullPath.startsWith(projectRoot)) {
    return {
      success: false,
      diff: '',
      validation: { syntaxValid: false, lintErrors: [], typeErrors: [] },
      snapshotId: ''
    };
  }

  // 读取原文件内容
  let originalContent = '';
  if (existsSync(fullPath)) {
    originalContent = readFileSync(fullPath, 'utf-8');
  }

  const lines = originalContent.split('\n');

  // 创建快照
  const snapshotId = snapshotManager.createSnapshot(fullPath, existsSync(fullPath) ? 'modify' : 'create');

  // 按行号倒序排列补丁，从后往前应用以保持行号正确
  const sortedPatches = [...patches].sort((a, b) => b.startLine - a.startLine);

  let newLines = [...lines];

  for (const patch of sortedPatches) {
    const startIdx = patch.startLine - 1; // 转为 0-based
    const endIdx = (patch.endLine ?? patch.startLine) - 1;

    switch (patch.operation) {
      case 'replace':
        if (patch.content !== undefined) {
          const newContentLines = patch.content.split('\n');
          newLines.splice(startIdx, endIdx - startIdx + 1, ...newContentLines);
        }
        break;

      case 'insert':
        if (patch.content !== undefined) {
          const insertLines = patch.content.split('\n');
          newLines.splice(startIdx, 0, ...insertLines);
        }
        break;

      case 'delete':
        newLines.splice(startIdx, endIdx - startIdx + 1);
        break;
    }
  }

  const newContent = newLines.join('\n');

  // 生成 diff
  const diff = Diff.createPatch(filePath, originalContent, newContent, 'original', 'modified');

  // 基础语法验证（简单检查）
  const validation = validateSyntax(newContent, filePath);

  // 如果不是 dry run，写入文件
  if (!dryRun) {
    const dir = dirname(fullPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(fullPath, newContent, 'utf-8');
    snapshotManager.updateSnapshotContent(snapshotId, newContent);
  }

  return {
    success: true,
    diff,
    validation,
    snapshotId
  };
}

/**
 * 基础语法验证
 */
function validateSyntax(content: string, filePath: string): {
  syntaxValid: boolean;
  lintErrors: Array<{ line: number; column: number; message: string; rule: string; severity: 'error' | 'warning' }>;
  typeErrors: Array<{ line: number; column: number; message: string; code: number }>;
} {
  const lintErrors: Array<{ line: number; column: number; message: string; rule: string; severity: 'error' | 'warning' }> = [];
  const typeErrors: Array<{ line: number; column: number; message: string; code: number }> = [];

  // 基础括号匹配检查
  const brackets: Array<{ char: string; line: number; column: number }> = [];
  const pairs: Record<string, string> = { '(': ')', '[': ']', '{': '}' };
  const closers: Record<string, string> = { ')': '(', ']': '[', '}': '{' };

  const lines = content.split('\n');
  let inString = false;
  let stringChar = '';
  let inComment = false;
  let inMultiLineComment = false;

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    for (let colIdx = 0; colIdx < line.length; colIdx++) {
      const char = line[colIdx];
      const prevChar = colIdx > 0 ? line[colIdx - 1] : '';
      const nextChar = colIdx < line.length - 1 ? line[colIdx + 1] : '';

      // 跳过字符串内容
      if (!inComment && !inMultiLineComment) {
        if ((char === '"' || char === "'" || char === '`') && prevChar !== '\\') {
          if (!inString) {
            inString = true;
            stringChar = char;
          } else if (char === stringChar) {
            inString = false;
          }
          continue;
        }
        if (inString) continue;
      }

      // 处理注释
      if (char === '/' && nextChar === '/' && !inMultiLineComment) {
        inComment = true;
        continue;
      }
      if (char === '/' && nextChar === '*' && !inComment) {
        inMultiLineComment = true;
        continue;
      }
      if (char === '*' && nextChar === '/' && inMultiLineComment) {
        inMultiLineComment = false;
        colIdx++; // 跳过 /
        continue;
      }
      if (inComment || inMultiLineComment) continue;

      // 检查括号
      if (pairs[char]) {
        brackets.push({ char, line: lineIdx + 1, column: colIdx + 1 });
      } else if (closers[char]) {
        const last = brackets.pop();
        if (!last || last.char !== closers[char]) {
          lintErrors.push({
            line: lineIdx + 1,
            column: colIdx + 1,
            message: `Unmatched bracket: ${char}`,
            rule: 'syntax/brackets',
            severity: 'error'
          });
        }
      }
    }
    inComment = false; // 单行注释在行尾结束
  }

  // 检查未闭合的括号
  for (const bracket of brackets) {
    lintErrors.push({
      line: bracket.line,
      column: bracket.column,
      message: `Unclosed bracket: ${bracket.char}`,
      rule: 'syntax/brackets',
      severity: 'error'
    });
  }

  return {
    syntaxValid: lintErrors.filter(e => e.severity === 'error').length === 0,
    lintErrors,
    typeErrors
  };
}

/**
 * 工具的 JSON Schema 定义
 */
export const applyPatchSchema = {
  name: 'apply_patch',
  description: '应用最小化代码补丁到指定文件。支持替换、插入、删除操作。',
  inputSchema: {
    type: 'object' as const,
    properties: {
      path: {
        type: 'string',
        description: '相对于项目根目录的文件路径'
      },
      patches: {
        type: 'array',
        description: '补丁列表',
        items: {
          type: 'object',
          properties: {
            operation: {
              type: 'string',
              enum: ['replace', 'insert', 'delete'],
              description: '操作类型：replace-替换, insert-插入, delete-删除'
            },
            startLine: {
              type: 'number',
              description: '起始行号（1-based）'
            },
            endLine: {
              type: 'number',
              description: '结束行号（1-based，包含）。对于 replace 和 delete 有效'
            },
            content: {
              type: 'string',
              description: '新内容。对于 replace 和 insert 必须提供'
            }
          },
          required: ['operation', 'startLine']
        }
      },
      dryRun: {
        type: 'boolean',
        description: '是否仅预览不实际修改，默认 false',
        default: false
      }
    },
    required: ['path', 'patches']
  }
};

