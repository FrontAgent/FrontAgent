import { existsSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

/**
 * 项目指令文件加载器
 *
 * 按 全局 → 仓库根 → 当前工作目录 的层级查找 AGENTS.md（缺失时回退 CLAUDE.md），
 * 合并为系统提示词中的"项目指令"区。SDD 约束仍是硬约束，项目指令是软性指导。
 */

const INSTRUCTION_FILE_NAMES = ['AGENTS.md', 'CLAUDE.md'] as const;

/** 单个指令文件的默认大小上限（字节），超出部分截断并附截断标记 */
export const DEFAULT_INSTRUCTION_FILE_MAX_BYTES = 32 * 1024;

export interface LoadProjectInstructionsOptions {
  /** 项目根目录（仓库根层级） */
  projectRoot: string;
  /** 当前工作目录；与 projectRoot 相同或位于其外时跳过该层级 */
  cwd?: string;
  /** 全局配置目录，默认 ~/.frontagent；测试可覆盖 */
  globalConfigDir?: string;
  /** 单文件大小上限（字节） */
  maxBytesPerFile?: number;
}

export interface ProjectInstructionSource {
  /** 指令文件的绝对路径 */
  path: string;
  /** 层级标签 */
  level: 'global' | 'project' | 'cwd';
  /** 文件内容（可能被截断） */
  content: string;
  /** 是否因超出大小上限被截断 */
  truncated: boolean;
}

function readInstructionFile(
  dir: string,
  level: ProjectInstructionSource['level'],
  maxBytes: number,
): ProjectInstructionSource | undefined {
  for (const fileName of INSTRUCTION_FILE_NAMES) {
    const filePath = join(dir, fileName);
    try {
      if (!existsSync(filePath) || !statSync(filePath).isFile()) continue;
      const raw = readFileSync(filePath, 'utf-8');
      const truncated = Buffer.byteLength(raw, 'utf-8') > maxBytes;
      const content = truncated
        ? `${Buffer.from(raw, 'utf-8').subarray(0, maxBytes).toString('utf-8')}\n\n[已截断：文件超过 ${maxBytes} 字节上限]`
        : raw;
      const trimmed = content.trim();
      if (!trimmed) continue;
      return { path: filePath, level, content: trimmed, truncated };
    } catch {
      // 不可读的指令文件按缺失处理，不阻塞任务
    }
  }
  return undefined;
}

/**
 * 发现各层级的项目指令文件（全局在前，最具体的层级在后）
 */
export function discoverProjectInstructionSources(
  options: LoadProjectInstructionsOptions,
): ProjectInstructionSource[] {
  const maxBytes = options.maxBytesPerFile ?? DEFAULT_INSTRUCTION_FILE_MAX_BYTES;
  const globalDir = options.globalConfigDir ?? join(homedir(), '.frontagent');
  const projectRoot = resolve(options.projectRoot);

  const sources: ProjectInstructionSource[] = [];

  const globalSource = readInstructionFile(globalDir, 'global', maxBytes);
  if (globalSource) sources.push(globalSource);

  const projectSource = readInstructionFile(projectRoot, 'project', maxBytes);
  if (projectSource) sources.push(projectSource);

  if (options.cwd) {
    const cwd = resolve(options.cwd);
    const withinProject = cwd !== projectRoot && cwd.startsWith(`${projectRoot}/`);
    if (withinProject) {
      const cwdSource = readInstructionFile(cwd, 'cwd', maxBytes);
      if (cwdSource) sources.push(cwdSource);
    }
  }

  return sources;
}

const LEVEL_LABELS: Record<ProjectInstructionSource['level'], string> = {
  global: '全局',
  project: '仓库根',
  cwd: '当前目录',
};

/**
 * 加载并格式化项目指令区内容；没有任何指令文件时返回 undefined
 */
export function loadProjectInstructions(
  options: LoadProjectInstructionsOptions,
): string | undefined {
  const sources = discoverProjectInstructionSources(options);
  if (sources.length === 0) return undefined;

  const parts: string[] = [
    '## 项目指令 (Project Instructions)',
    '以下指令来自项目的 AGENTS.md/CLAUDE.md，是软性指导；与 SDD 约束冲突时以 SDD 约束为准。',
  ];

  for (const source of sources) {
    parts.push(`\n### 来源（${LEVEL_LABELS[source.level]}）: ${source.path}\n${source.content}`);
  }

  return parts.join('\n');
}
