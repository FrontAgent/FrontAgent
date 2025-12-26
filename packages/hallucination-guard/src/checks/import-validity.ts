/**
 * 导入有效性检查
 * 验证代码中的 import 是否有效
 */

import { existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import type { HallucinationCheckResult } from '@frontagent/shared';

export interface ImportValidityCheckInput {
  importPath: string;
  sourceFilePath: string;
  projectRoot: string;
}

/**
 * 检查导入是否有效
 */
export async function checkImportValidity(
  input: ImportValidityCheckInput
): Promise<HallucinationCheckResult> {
  const { importPath, sourceFilePath, projectRoot } = input;

  // Node.js 内置模块
  if (importPath.startsWith('node:')) {
    return {
      pass: true,
      type: 'import_validity',
      severity: 'info',
      message: `Node.js built-in module: ${importPath}`
    };
  }

  // 外部包（不以 . 或 / 开头）
  if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
    const isValidPackage = await checkPackageExists(importPath, projectRoot);
    if (!isValidPackage) {
      return {
        pass: false,
        type: 'import_validity',
        severity: 'block',
        message: `Hallucination detected: Package "${importPath}" is not installed`,
        details: { importPath, type: 'external_package' }
      };
    }
    return {
      pass: true,
      type: 'import_validity',
      severity: 'info',
      message: `External package: ${importPath}`
    };
  }

  // 相对导入
  const sourceDir = dirname(resolve(projectRoot, sourceFilePath));
  const possiblePaths = generatePossiblePaths(importPath, sourceDir);

  for (const possiblePath of possiblePaths) {
    if (existsSync(possiblePath)) {
      return {
        pass: true,
        type: 'import_validity',
        severity: 'info',
        message: `Local import resolved: ${importPath}`
      };
    }
  }

  return {
    pass: false,
    type: 'import_validity',
    severity: 'block',
    message: `Hallucination detected: Cannot resolve import "${importPath}" from "${sourceFilePath}"`,
    details: { importPath, sourceFilePath, triedPaths: possiblePaths }
  };
}

/**
 * 检查 npm 包是否存在
 */
async function checkPackageExists(packageName: string, projectRoot: string): Promise<boolean> {
  // 处理 scoped packages 和 subpath imports
  const packageRoot = packageName.startsWith('@')
    ? packageName.split('/').slice(0, 2).join('/')
    : packageName.split('/')[0];

  const nodeModulesPath = join(projectRoot, 'node_modules', packageRoot);
  
  if (existsSync(nodeModulesPath)) {
    return true;
  }

  // 检查 package.json 中的依赖
  const packageJsonPath = join(projectRoot, 'package.json');
  if (existsSync(packageJsonPath)) {
    try {
      const packageJson = await import(packageJsonPath, { assert: { type: 'json' } });
      const deps = {
        ...packageJson.default?.dependencies,
        ...packageJson.default?.devDependencies,
        ...packageJson.default?.peerDependencies
      };
      return packageRoot in deps;
    } catch {
      // 如果无法读取 package.json，回退到目录检查
      return false;
    }
  }

  return false;
}

/**
 * 生成可能的文件路径
 */
function generatePossiblePaths(importPath: string, sourceDir: string): string[] {
  const basePath = resolve(sourceDir, importPath);
  const extensions = ['.ts', '.tsx', '.js', '.jsx', '.json', '.mjs', '.cjs'];
  
  const paths: string[] = [];

  // 直接路径
  paths.push(basePath);
  
  // 添加扩展名
  for (const ext of extensions) {
    paths.push(basePath + ext);
  }
  
  // index 文件
  for (const ext of extensions) {
    paths.push(join(basePath, `index${ext}`));
  }

  return paths;
}

/**
 * 从代码中提取所有 import
 */
export function extractImports(code: string): string[] {
  const imports: string[] = [];
  
  // ES6 import
  const importRegex = /import\s+(?:[\w\s{},*]+\s+from\s+)?['"]([^'"]+)['"]/g;
  let match;
  while ((match = importRegex.exec(code)) !== null) {
    imports.push(match[1]);
  }

  // Dynamic import
  const dynamicImportRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = dynamicImportRegex.exec(code)) !== null) {
    imports.push(match[1]);
  }

  // require
  const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = requireRegex.exec(code)) !== null) {
    imports.push(match[1]);
  }

  return [...new Set(imports)];
}

/**
 * 检查代码中所有导入的有效性
 */
export async function checkAllImports(
  code: string,
  sourceFilePath: string,
  projectRoot: string
): Promise<HallucinationCheckResult[]> {
  const imports = extractImports(code);
  
  return Promise.all(
    imports.map(importPath =>
      checkImportValidity({ importPath, sourceFilePath, projectRoot })
    )
  );
}

