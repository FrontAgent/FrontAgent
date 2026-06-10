/**
 * 路径包含关系判断
 * 供各检查共用的项目根目录约束 helper
 */

import { isAbsolute, relative } from 'node:path';

/**
 * 判断 child 是否位于 parent 目录内（含 parent 本身）。
 * 使用 path.relative 而非字符串前缀，避免同级目录（如 /tmp/project-secret）误判。
 */
export function isInsidePath(child: string, parent: string): boolean {
  const rel = relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}
