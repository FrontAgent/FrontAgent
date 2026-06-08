import type { ChildEntry, IndexFile, NavigateOptions } from './types.js';

export function inferImportance(name: string): 'high' | 'normal' {
  if (/^(readme|package|tsconfig|index|main|app)\./i.test(name)) return 'high';
  if (/\.(config|rc)\./i.test(name)) return 'high';
  return 'normal';
}

export function inferDirectoryPurpose(index: IndexFile): string {
  const dirName = index.directory.name.toLowerCase();
  if (index.directory.path === '.')
    return 'Project root directory containing source code, configuration, and supporting files.';
  if (dirName === 'src') return 'Primary application source directory.';
  if (dirName === 'docs')
    return 'Documentation directory for project guides and reference material.';
  if (dirName === 'test' || dirName === 'tests' || dirName === '__tests__')
    return 'Automated test directory.';
  if (dirName === 'scripts') return 'Automation scripts directory.';
  if (dirName === 'components') return 'Reusable component directory.';
  if (dirName === 'lib') return 'Shared library code directory.';
  if (dirName === 'api' || dirName === 'services') return 'API/service layer directory.';
  if (dirName === 'hooks') return 'Custom React hooks directory.';
  if (dirName === 'utils' || dirName === 'helpers') return 'Utility functions directory.';
  if (dirName === 'pages' || dirName === 'views') return 'Page/view components directory.';
  if (dirName === 'store' || dirName === 'stores') return 'State management directory.';
  if (dirName === 'styles') return 'Stylesheets directory.';
  if (dirName === 'assets') return 'Static assets directory.';
  if (dirName === 'types') return 'TypeScript type definitions directory.';

  const fileCount = index.children.filter((c) => c.type === 'file').length;
  const dirCount = index.children.filter((c) => c.type === 'dir').length;
  if (fileCount === 0 && dirCount > 0) return 'Grouping directory for related subdirectories.';
  const hasTS = index.children.some((c) => ['.ts', '.tsx', '.js', '.jsx'].includes(c.ext));
  if (hasTS) return 'Source directory for related implementation files.';
  if (index.children.some((c) => c.ext === '.md')) return 'Documentation-focused directory.';
  return 'Directory for related project files.';
}

export function scoreCandidate(entry: ChildEntry, intent: NavigateOptions['intent']): number {
  let score = entry.importance === 'high' ? 80 : 40;
  const name = entry.name.toLowerCase();
  if (
    entry.type === 'dir' &&
    ['src', 'components', 'pages', 'views', 'hooks', 'api', 'services'].includes(name)
  )
    score += 30;
  if (intent === 'find_conventions' && (name === 'readme.md' || name.includes('config')))
    score += 25;
  if (intent === 'locate' && entry.importance === 'high') score += 20;
  return score;
}
