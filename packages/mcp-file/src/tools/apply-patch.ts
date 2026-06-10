/**
 * apply_patch 工具
 * 应用最小化代码补丁
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { FilePatch, PatchResult } from '@frontagent/shared';
import * as Diff from 'diff';
import { assertWritableByPolicy, resolveWritePath } from '../path-safety.js';
import type { SnapshotManager } from '../snapshot.js';

export interface ApplyPatchParams {
  path: string;
  patches: FilePatch[];
  dryRun?: boolean;
  __frontagentSecurityApproved?: boolean;
}

/**
 * 应用补丁
 */
export function applyPatch(
  params: ApplyPatchParams,
  projectRoot: string,
  snapshotManager: SnapshotManager,
): PatchResult {
  const { path: filePath, patches, dryRun = false, __frontagentSecurityApproved = false } = params;

  const safePath = resolveWritePath(filePath, projectRoot);
  if (!safePath.ok) {
    return {
      success: false,
      diff: '',
      validation: { syntaxValid: false, lintErrors: [], typeErrors: [] },
      snapshotId: '',
      error: safePath.error,
    };
  }

  const policyError = assertWritableByPolicy({
    relativePath: safePath.relativePath,
    approved: __frontagentSecurityApproved,
  });
  if (policyError) {
    return {
      success: false,
      diff: '',
      validation: { syntaxValid: false, lintErrors: [], typeErrors: [] },
      snapshotId: '',
      error: policyError,
    };
  }

  if (!existsSync(safePath.fullPath)) {
    return {
      success: false,
      diff: '',
      validation: { syntaxValid: false, lintErrors: [], typeErrors: [] },
      snapshotId: '',
      error: `Cannot apply patch: file does not exist: ${filePath}`,
    };
  }

  // 读取原文件内容
  const originalContent = readFileSync(safePath.fullPath, 'utf-8');

  const lines = originalContent.split('\n');

  const boundsError = validatePatchBounds(patches, lines.length);
  if (boundsError) {
    return {
      success: false,
      diff: '',
      validation: { syntaxValid: false, lintErrors: [], typeErrors: [] },
      snapshotId: '',
      error: boundsError,
    };
  }

  // 创建快照
  const snapshotId = dryRun ? '' : snapshotManager.createSnapshot(safePath.fullPath, 'modify');

  // 按行号倒序排列补丁，从后往前应用以保持行号正确
  const sortedPatches = [...patches].sort((a, b) => b.startLine - a.startLine);

  const newLines = [...lines];

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
    const dir = dirname(safePath.fullPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(safePath.fullPath, newContent, 'utf-8');
    snapshotManager.updateSnapshotContent(snapshotId, newContent);
  }

  return {
    success: true,
    diff,
    validation,
    snapshotId,
  };
}

/**
 * 校验补丁行号边界。
 * 契约：所有行号均基于原始文件内容（1-based）；补丁按 startLine 倒序自下而上应用，
 * 因此各补丁的行范围不得重叠——重叠时先应用的补丁会改变后应用补丁的目标行，
 * 导致 splice 静默损坏内容。越界或重叠都必须在创建 snapshot / 写入前整体拒绝。
 */
function validatePatchBounds(patches: FilePatch[], lineCount: number): string | null {
  for (const patch of patches) {
    const { operation, startLine, endLine } = patch;

    if (!Number.isInteger(startLine) || startLine < 1) {
      return `Invalid patch (${operation}): startLine ${startLine} must be an integer >= 1`;
    }

    if (operation === 'insert') {
      // insert 在 startLine 之前插入，允许 lineCount + 1 表示追加到文件末尾
      if (startLine > lineCount + 1) {
        return `Invalid patch (insert): startLine ${startLine} exceeds file length + 1 (${lineCount} lines)`;
      }
      if (endLine !== undefined) {
        return `Invalid patch (insert): endLine is not supported for insert operations`;
      }
      continue;
    }

    if (startLine > lineCount) {
      return `Invalid patch (${operation}): startLine ${startLine} exceeds file length (${lineCount} lines)`;
    }

    if (endLine !== undefined) {
      if (!Number.isInteger(endLine) || endLine < startLine) {
        return `Invalid patch (${operation}): endLine ${endLine} must be an integer >= startLine (${startLine})`;
      }
      if (endLine > lineCount) {
        return `Invalid patch (${operation}): endLine ${endLine} exceeds file length (${lineCount} lines)`;
      }
    }
  }

  return validatePatchOverlap(patches);
}

/**
 * 拒绝行范围重叠的补丁组合。
 * replace/delete 占用 [startLine, endLine ?? startLine]；insert 占用 startLine 这一插入点
 * （落在其他补丁范围内时，倒序应用会先改写目标区间，再让 insert/范围补丁作用到错误的行）。
 * 两个 insert 指向同一行不冲突：插入点不消耗原始行。
 */
function validatePatchOverlap(patches: FilePatch[]): string | null {
  const describe = (p: FilePatch): string =>
    p.operation === 'insert'
      ? `insert at line ${p.startLine}`
      : `${p.operation} at lines ${p.startLine}-${p.endLine ?? p.startLine}`;

  for (let i = 0; i < patches.length; i++) {
    for (let j = i + 1; j < patches.length; j++) {
      const a = patches[i];
      const b = patches[j];
      if (a.operation === 'insert' && b.operation === 'insert') {
        continue;
      }

      let conflict: boolean;
      if (a.operation === 'insert' || b.operation === 'insert') {
        const point = a.operation === 'insert' ? a : b;
        const range = a.operation === 'insert' ? b : a;
        conflict =
          point.startLine >= range.startLine &&
          point.startLine <= (range.endLine ?? range.startLine);
      } else {
        conflict =
          a.startLine <= (b.endLine ?? b.startLine) && b.startLine <= (a.endLine ?? a.startLine);
      }

      if (conflict) {
        return `Invalid patch set: ${describe(a)} overlaps ${describe(b)}; line numbers refer to the original file content and patch ranges must not overlap`;
      }
    }
  }

  return null;
}

/**
 * 基础语法验证
 */
function validateSyntax(
  content: string,
  _filePath: string,
): {
  syntaxValid: boolean;
  lintErrors: Array<{
    line: number;
    column: number;
    message: string;
    rule: string;
    severity: 'error' | 'warning';
  }>;
  typeErrors: Array<{ line: number; column: number; message: string; code: number }>;
} {
  const lintErrors: Array<{
    line: number;
    column: number;
    message: string;
    rule: string;
    severity: 'error' | 'warning';
  }> = [];
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
            severity: 'error',
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
      severity: 'error',
    });
  }

  return {
    syntaxValid: lintErrors.filter((e) => e.severity === 'error').length === 0,
    lintErrors,
    typeErrors,
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
        description: '相对于项目根目录的文件路径',
      },
      patches: {
        type: 'array',
        description:
          '补丁列表。所有行号均相对原始文件内容（应用任何补丁之前），各补丁的行范围不得重叠',
        items: {
          type: 'object',
          properties: {
            operation: {
              type: 'string',
              enum: ['replace', 'insert', 'delete'],
              description: '操作类型：replace-替换, insert-插入, delete-删除',
            },
            startLine: {
              type: 'number',
              description: '起始行号（1-based）',
            },
            endLine: {
              type: 'number',
              description: '结束行号（1-based，包含）。对于 replace 和 delete 有效',
            },
            content: {
              type: 'string',
              description: '新内容。对于 replace 和 insert 必须提供',
            },
          },
          required: ['operation', 'startLine'],
        },
      },
      dryRun: {
        type: 'boolean',
        description: '是否仅预览不实际修改，默认 false',
        default: false,
      },
    },
    required: ['path', 'patches'],
  },
};
