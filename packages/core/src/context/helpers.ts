import type {
  FilesenseNavigationContext,
  FilesenseNavigationIntent,
  ModuleInfo,
} from '../types.js';

export function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

export function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

export function normalizeFilesenseNavigation(
  value: unknown,
  intent?: FilesenseNavigationIntent,
  paths: string[] = ['.'],
): FilesenseNavigationContext | undefined {
  const data = asRecord(value);
  if (!data) return undefined;

  const scannedInput = asRecord(data.scanned);
  const summaryInput = asRecord(data.summary);
  const candidates = Array.isArray(data.candidates)
    ? data.candidates
        .map((item) => asRecord(item))
        .filter((item): item is Record<string, unknown> => Boolean(item))
        .map((item) => ({
          path: typeof item.path === 'string' ? item.path : '',
          type: item.type === 'dir' ? ('dir' as const) : ('file' as const),
          reason: typeof item.reason === 'string' ? item.reason : 'Filesense candidate',
          score: typeof item.score === 'number' ? item.score : 0,
        }))
        .filter((item) => item.path)
        .slice(0, 15)
    : [];

  const importantDirs = Array.isArray(summaryInput?.importantDirs)
    ? summaryInput.importantDirs
        .map((item) => asRecord(item))
        .filter((item): item is Record<string, unknown> => Boolean(item))
        .map((item) => ({
          path: typeof item.path === 'string' ? item.path : '',
          purpose: typeof item.purpose === 'string' ? item.purpose : 'Directory',
          confidence: typeof item.confidence === 'number' ? item.confidence : 0,
        }))
        .filter((item) => item.path)
        .slice(0, 10)
    : [];

  return {
    intent,
    paths: stringArray(scannedInput?.paths).length > 0 ? stringArray(scannedInput?.paths) : paths,
    scanned: {
      entries: typeof scannedInput?.entries === 'number' ? scannedInput.entries : 0,
      elapsedMs: typeof scannedInput?.elapsedMs === 'number' ? scannedInput.elapsedMs : 0,
      truncated: scannedInput?.truncated === true,
    },
    summary: summaryInput
      ? {
          projectType:
            typeof summaryInput.projectType === 'string' ? summaryInput.projectType : undefined,
          packageManager:
            typeof summaryInput.packageManager === 'string'
              ? summaryInput.packageManager
              : undefined,
          mainEntrypoints: stringArray(summaryInput.mainEntrypoints).slice(0, 8),
          importantDirs,
          conventions: stringArray(summaryInput.conventions).slice(0, 8),
          risks: stringArray(summaryInput.risks).slice(0, 8),
        }
      : undefined,
    candidates,
    warnings: [...stringArray(data.warnings), ...stringArray(summaryInput?.risks)].slice(0, 8),
  };
}

export function formatFilesenseNavigationContext(navigation: FilesenseNavigationContext): string {
  const lines: string[] = [];
  lines.push(`- intent: ${navigation.intent ?? 'unknown'}`);
  lines.push(`- paths: ${navigation.paths.join(', ')}`);
  lines.push(
    `- scanned: ${navigation.scanned.entries} entries, ${navigation.scanned.elapsedMs}ms${navigation.scanned.truncated ? ', truncated' : ''}`,
  );

  if (navigation.summary?.projectType)
    lines.push(`- projectType: ${navigation.summary.projectType}`);
  if (navigation.summary?.packageManager)
    lines.push(`- packageManager: ${navigation.summary.packageManager}`);
  if (navigation.summary?.mainEntrypoints.length) {
    lines.push('- mainEntrypoints:');
    for (const item of navigation.summary.mainEntrypoints.slice(0, 6)) lines.push(`  - ${item}`);
  }
  if (navigation.summary?.importantDirs.length) {
    lines.push('- importantDirs:');
    for (const item of navigation.summary.importantDirs.slice(0, 6))
      lines.push(`  - ${item.path}: ${item.purpose}`);
  }
  if (navigation.summary?.conventions.length) {
    lines.push('- conventions:');
    for (const item of navigation.summary.conventions.slice(0, 6)) lines.push(`  - ${item}`);
  }
  if (navigation.candidates.length) {
    lines.push('- candidates:');
    for (const item of navigation.candidates.slice(0, 10))
      lines.push(`  - ${item.path} (${item.type}, score=${item.score}): ${item.reason}`);
  }
  if (navigation.warnings.length) {
    lines.push('- warnings:');
    for (const item of navigation.warnings.slice(0, 6)) lines.push(`  - ${item}`);
  }

  return lines.join('\n');
}

/**
 * 解析代码中的导入语句
 */
export function parseImports(code: string): string[] {
  const imports: string[] = [];

  // 匹配 ES6 import 语句
  const importRegex = /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+)?['"]([^'"]+)['"]/g;
  let match;
  while ((match = importRegex.exec(code)) !== null) {
    imports.push(match[1]);
  }

  // 匹配 require 语句
  const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = requireRegex.exec(code)) !== null) {
    imports.push(match[1]);
  }

  return [...new Set(imports)];
}

/**
 * 解析代码中的导出语句
 */
export function parseExports(code: string): { exports: string[]; defaultExport?: string } {
  const exports: string[] = [];
  let defaultExport: string | undefined;

  // 匹配命名导出
  const namedExportRegex = /export\s+(?:const|let|var|function|class|type|interface)\s+(\w+)/g;
  let match;
  while ((match = namedExportRegex.exec(code)) !== null) {
    exports.push(match[1]);
  }

  // 匹配 export { ... } 语句
  const exportBraceRegex = /export\s*\{([^}]+)\}/g;
  while ((match = exportBraceRegex.exec(code)) !== null) {
    const names = match[1].split(',').map(
      (n) =>
        n
          .trim()
          .split(/\s+as\s+/)
          .pop()
          ?.trim() || '',
    );
    exports.push(...names.filter((n) => n && n !== 'default'));
  }

  // 匹配默认导出
  const defaultExportRegex = /export\s+default\s+(?:function\s+|class\s+)?(\w+)?/;
  const defaultMatch = code.match(defaultExportRegex);
  if (defaultMatch) {
    defaultExport = defaultMatch[1] || 'default';
  }

  return { exports: [...new Set(exports)], defaultExport };
}

/**
 * 根据文件路径判断模块类型
 */
export function inferModuleType(path: string): ModuleInfo['type'] {
  const lowerPath = path.toLowerCase();

  if (lowerPath.includes('/components/')) return 'component';
  if (lowerPath.includes('/pages/') || lowerPath.includes('/views/')) return 'page';
  if (lowerPath.includes('/stores/') || lowerPath.includes('/store/')) return 'store';
  if (lowerPath.includes('/api/') || lowerPath.includes('/services/')) return 'api';
  if (
    lowerPath.includes('/utils/') ||
    lowerPath.includes('/helpers/') ||
    lowerPath.includes('/lib/')
  )
    return 'util';
  if (
    lowerPath.endsWith('.config.ts') ||
    lowerPath.endsWith('.config.js') ||
    lowerPath.includes('/config/')
  )
    return 'config';
  if (lowerPath.endsWith('.css') || lowerPath.endsWith('.scss') || lowerPath.endsWith('.less'))
    return 'style';

  return 'other';
}

/**
 * 解析相对路径为绝对路径
 */
export function resolveImportPath(
  importPath: string,
  fromPath: string,
  _projectRoot: string,
): string | null {
  // 忽略外部包
  if (!importPath.startsWith('.') && !importPath.startsWith('@/')) {
    return null;
  }

  // 处理 @/ 别名
  if (importPath.startsWith('@/')) {
    const srcPath = importPath.replace('@/', 'src/');
    return normalizeModulePath(srcPath);
  }

  // 处理相对路径
  const fromDir = fromPath.substring(0, fromPath.lastIndexOf('/'));
  const parts = fromDir.split('/');
  const importParts = importPath.split('/');

  for (const part of importParts) {
    if (part === '..') {
      parts.pop();
    } else if (part !== '.') {
      parts.push(part);
    }
  }

  return normalizeModulePath(parts.join('/'));
}

/**
 * 规范化模块路径（添加扩展名）
 */
export function normalizeModulePath(path: string): string {
  // 如果已有扩展名则直接返回
  if (/\.(tsx?|jsx?|mjs|cjs)$/.test(path)) {
    return path;
  }

  // 默认添加 .tsx 扩展名（React 项目最常用）
  return `${path}.tsx`;
}

export function mapToRecord<T>(
  map: Map<string, T>,
  cloneValue?: (value: T) => T,
): Record<string, T> {
  const record: Record<string, T> = {};
  for (const [key, value] of map.entries()) {
    record[key] = cloneValue ? cloneValue(value) : value;
  }
  return record;
}

export function cloneStringArray(input: string[]): string[] {
  return [...input];
}

export function recordToClonedStringArrayMap(
  record: Record<string, string[]>,
): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const [key, value] of Object.entries(record)) {
    map.set(key, cloneStringArray(value));
  }
  return map;
}

export function parentDirectoriesForPath(path: string): string[] {
  const parts = path.split('/').filter(Boolean);
  const parents: string[] = [];

  for (let i = 1; i < parts.length; i++) {
    parents.push(parts.slice(0, i).join('/'));
  }

  return parents;
}
