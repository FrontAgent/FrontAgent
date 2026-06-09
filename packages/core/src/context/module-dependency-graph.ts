import type { ModuleDependencyGraph, ModuleInfo } from '../types.js';
import { inferModuleType, parseExports, parseImports, resolveImportPath } from './helpers.js';

export interface ModuleGraphToolResult {
  success?: boolean;
  content?: string;
  [key: string]: unknown;
}

const MODULE_FILE_EXTENSION_PATTERN = /\.(tsx?|jsx?|mjs|cjs)$/;

export function updateModuleDependencyGraphFromToolResult(
  moduleDependencyGraph: ModuleDependencyGraph,
  toolName: string,
  params: Record<string, unknown>,
  result: ModuleGraphToolResult,
): boolean {
  if (!result.success) return false;
  if (toolName !== 'create_file' && toolName !== 'apply_patch') return false;

  const path = params.path as string;
  const content = (params.content as string) || (result.content as string) || '';

  if (!MODULE_FILE_EXTENSION_PATTERN.test(path)) return false;

  const imports = parseImports(content);
  const { exports: exportedSymbols, defaultExport } = parseExports(content);

  const moduleInfo: ModuleInfo = {
    path,
    type: inferModuleType(path),
    exports: exportedSymbols,
    defaultExport,
    imports,
    createdAt: Date.now(),
  };

  moduleDependencyGraph.modules.set(path, moduleInfo);

  const resolvedDeps = imports
    .map((importPath) => resolveImportPath(importPath, path, ''))
    .filter((resolved): resolved is string => Boolean(resolved));
  moduleDependencyGraph.dependencies.set(path, resolvedDeps);

  removeReverseDependenciesForModule(moduleDependencyGraph, path);
  addReverseDependenciesForModule(moduleDependencyGraph, path, resolvedDeps);

  return true;
}

function removeReverseDependenciesForModule(
  moduleDependencyGraph: ModuleDependencyGraph,
  path: string,
): void {
  for (const [depPath, reverseDeps] of moduleDependencyGraph.reverseDependencies.entries()) {
    const nextReverseDeps = reverseDeps.filter((reversePath) => reversePath !== path);
    if (nextReverseDeps.length > 0) {
      moduleDependencyGraph.reverseDependencies.set(depPath, nextReverseDeps);
    } else {
      moduleDependencyGraph.reverseDependencies.delete(depPath);
    }
  }
}

function addReverseDependenciesForModule(
  moduleDependencyGraph: ModuleDependencyGraph,
  path: string,
  resolvedDeps: string[],
): void {
  for (const dep of resolvedDeps) {
    const reverseDeps = moduleDependencyGraph.reverseDependencies.get(dep) || [];
    if (!reverseDeps.includes(path)) {
      reverseDeps.push(path);
      moduleDependencyGraph.reverseDependencies.set(dep, reverseDeps);
    }
  }
}
