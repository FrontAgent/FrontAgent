/**
 * 文件存在性检查
 * 验证 Agent 引用的文件是否真实存在
 */

import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import type { HallucinationCheckResult } from '@frontagent/shared';

export interface FileExistenceCheckInput {
  path: string;
  projectRoot: string;
  shouldExist?: boolean; // 默认 true，检查文件应该存在
}

/**
 * 检查文件是否存在
 */
export async function checkFileExistence(
  input: FileExistenceCheckInput
): Promise<HallucinationCheckResult> {
  const { path, projectRoot, shouldExist = true } = input;
  
  const fullPath = resolve(projectRoot, path);
  
  // 安全检查：确保路径在项目根目录内
  if (!fullPath.startsWith(projectRoot)) {
    return {
      pass: false,
      type: 'file_existence',
      severity: 'block',
      message: `Security violation: Path "${path}" is outside project root`,
      details: { path, projectRoot }
    };
  }

  const exists = existsSync(fullPath);
  
  if (shouldExist && !exists) {
    return {
      pass: false,
      type: 'file_existence',
      severity: 'block',
      message: `Hallucination detected: File "${path}" does not exist`,
      details: { path, exists: false }
    };
  }

  if (!shouldExist && exists) {
    return {
      pass: false,
      type: 'file_existence',
      severity: 'warn',
      message: `File "${path}" already exists`,
      details: { path, exists: true }
    };
  }

  // 如果文件存在，额外检查是否真的是文件
  if (exists) {
    try {
      const stat = statSync(fullPath);
      if (!stat.isFile()) {
        return {
          pass: false,
          type: 'file_existence',
          severity: 'block',
          message: `"${path}" exists but is not a file`,
          details: { path, isFile: false, isDirectory: stat.isDirectory() }
        };
      }
    } catch (error) {
      return {
        pass: false,
        type: 'file_existence',
        severity: 'block',
        message: `Cannot access "${path}": ${error instanceof Error ? error.message : String(error)}`,
        details: { path, error: String(error) }
      };
    }
  }

  return {
    pass: true,
    type: 'file_existence',
    severity: 'info',
    message: shouldExist ? `File "${path}" exists` : `File "${path}" does not exist (as expected)`
  };
}

/**
 * 批量检查文件存在性
 */
export async function checkFilesExistence(
  paths: string[],
  projectRoot: string
): Promise<HallucinationCheckResult[]> {
  return Promise.all(
    paths.map(path => checkFileExistence({ path, projectRoot }))
  );
}

