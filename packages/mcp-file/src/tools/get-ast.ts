/**
 * get_ast 工具
 * 获取文件的 AST 结构分析
 */

import { existsSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { Project, SyntaxKind } from 'ts-morph';

export interface GetASTParams {
  path: string;
}

export interface FunctionInfo {
  name: string;
  line: number;
  parameters: string[];
  returnType?: string;
  isExported: boolean;
  isAsync: boolean;
}

export interface ImportInfo {
  moduleSpecifier: string;
  defaultImport?: string;
  namedImports: string[];
  namespaceImport?: string;
  line: number;
}

export interface ComponentInfo {
  name: string;
  line: number;
  type: 'function' | 'class';
  props?: string[];
  isExported: boolean;
}

export interface ASTResult {
  success: boolean;
  imports?: ImportInfo[];
  exports?: string[];
  functions?: FunctionInfo[];
  components?: ComponentInfo[];
  classes?: Array<{ name: string; line: number; isExported: boolean }>;
  interfaces?: Array<{ name: string; line: number; isExported: boolean }>;
  types?: Array<{ name: string; line: number; isExported: boolean }>;
  error?: string;
}

/**
 * 获取文件的 AST 分析
 */
export function getAST(params: GetASTParams, projectRoot: string): ASTResult {
  const { path: filePath } = params;

  // 解析完整路径
  const fullPath = resolve(projectRoot, filePath);

  // 安全检查
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

  // 检查文件类型
  const ext = extname(fullPath).toLowerCase();
  if (!['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
    return {
      success: false,
      error: `Unsupported file type for AST analysis: ${ext}`
    };
  }

  try {
    const project = new Project({
      compilerOptions: {
        allowJs: true,
        jsx: ext.includes('x') ? 2 : undefined // React JSX
      }
    });

    const sourceFile = project.addSourceFileAtPath(fullPath);

    // 提取 imports
    const imports: ImportInfo[] = sourceFile.getImportDeclarations().map(imp => {
      const namedImports = imp.getNamedImports().map(ni => ni.getName());
      const defaultImport = imp.getDefaultImport()?.getText();
      const namespaceImport = imp.getNamespaceImport()?.getText();

      return {
        moduleSpecifier: imp.getModuleSpecifierValue(),
        defaultImport,
        namedImports,
        namespaceImport,
        line: imp.getStartLineNumber()
      };
    });

    // 提取 exports
    const exports: string[] = [];
    sourceFile.getExportedDeclarations().forEach((_, key) => {
      exports.push(key);
    });

    // 提取函数
    const functions: FunctionInfo[] = sourceFile.getFunctions().map(fn => ({
      name: fn.getName() ?? 'anonymous',
      line: fn.getStartLineNumber(),
      parameters: fn.getParameters().map(p => `${p.getName()}: ${p.getType().getText()}`),
      returnType: fn.getReturnType().getText(),
      isExported: fn.isExported(),
      isAsync: fn.isAsync()
    }));

    // 提取类
    const classes = sourceFile.getClasses().map(cls => ({
      name: cls.getName() ?? 'anonymous',
      line: cls.getStartLineNumber(),
      isExported: cls.isExported()
    }));

    // 提取接口
    const interfaces = sourceFile.getInterfaces().map(intf => ({
      name: intf.getName(),
      line: intf.getStartLineNumber(),
      isExported: intf.isExported()
    }));

    // 提取类型别名
    const types = sourceFile.getTypeAliases().map(ta => ({
      name: ta.getName(),
      line: ta.getStartLineNumber(),
      isExported: ta.isExported()
    }));

    // 检测 React 组件
    const components: ComponentInfo[] = [];

    // 检查函数组件（返回 JSX）
    for (const fn of sourceFile.getFunctions()) {
      if (isReactComponent(fn)) {
        components.push({
          name: fn.getName() ?? 'anonymous',
          line: fn.getStartLineNumber(),
          type: 'function',
          props: extractPropsFromFunction(fn),
          isExported: fn.isExported()
        });
      }
    }

    // 检查箭头函数组件
    sourceFile.getVariableDeclarations().forEach(vd => {
      const init = vd.getInitializer();
      if (init && init.getKind() === SyntaxKind.ArrowFunction) {
        const name = vd.getName();
        // 简单启发式：PascalCase 名称 + 可能返回 JSX
        if (/^[A-Z]/.test(name)) {
          components.push({
            name,
            line: vd.getStartLineNumber(),
            type: 'function',
            isExported: vd.isExported()
          });
        }
      }
    });

    // 检查类组件
    for (const cls of sourceFile.getClasses()) {
      const extendClause = cls.getExtends();
      if (extendClause) {
        const baseClass = extendClause.getText();
        if (baseClass.includes('Component') || baseClass.includes('PureComponent')) {
          components.push({
            name: cls.getName() ?? 'anonymous',
            line: cls.getStartLineNumber(),
            type: 'class',
            isExported: cls.isExported()
          });
        }
      }
    }

    return {
      success: true,
      imports,
      exports,
      functions,
      components,
      classes,
      interfaces,
      types
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to parse AST: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * 检查函数是否是 React 组件
 */
function isReactComponent(fn: import('ts-morph').FunctionDeclaration): boolean {
  const name = fn.getName();
  if (!name || !/^[A-Z]/.test(name)) {
    return false;
  }

  // 检查返回类型是否包含 JSX
  const returnType = fn.getReturnType().getText();
  if (returnType.includes('JSX') || returnType.includes('ReactElement') || returnType.includes('ReactNode')) {
    return true;
  }

  // 检查函数体是否包含 JSX
  const body = fn.getBody()?.getText() ?? '';
  return body.includes('<') && (body.includes('/>') || body.includes('</'));
}

/**
 * 从函数中提取 props 类型
 */
function extractPropsFromFunction(fn: import('ts-morph').FunctionDeclaration): string[] {
  const params = fn.getParameters();
  if (params.length === 0) return [];

  const firstParam = params[0];
  const typeNode = firstParam.getTypeNode();
  if (!typeNode) return [];

  // 尝试解析 props 类型
  const typeText = typeNode.getText();
  return [typeText];
}

/**
 * 工具的 JSON Schema 定义
 */
export const getASTSchema = {
  name: 'get_ast',
  description: '获取 TypeScript/JavaScript 文件的 AST 结构分析，包括导入、导出、函数、组件等信息。',
  inputSchema: {
    type: 'object' as const,
    properties: {
      path: {
        type: 'string',
        description: '相对于项目根目录的文件路径（支持 .ts, .tsx, .js, .jsx）'
      }
    },
    required: ['path']
  }
};

