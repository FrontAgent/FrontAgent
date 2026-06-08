import type { ModuleInfo, ProjectFacts } from '../types.js';

const DIRECTORY_CONTENT_PREVIEW_LIMIT = 5;
const MODULE_EXPORT_PREVIEW_LIMIT = 3;
const MISSING_MODULE_REFERENCE_LIMIT = 10;
const RECENT_ERROR_LIMIT = 5;

export interface MissingModuleReference {
  from: string;
  missing: string;
  importPath: string;
}

export interface SerializeProjectFactsOptions {
  missingModuleReferences?: MissingModuleReference[];
}

export function serializeProjectFactsForLLM(
  facts: ProjectFacts,
  options: SerializeProjectFactsOptions = {},
): string {
  const parts: string[] = [];

  parts.push(`## 事实版本: ${facts.revision}`);

  parts.push('## 文件系统状态');

  if (facts.filesystem.existingFiles.size > 0) {
    parts.push('\n### 已确认存在的文件:');
    for (const file of facts.filesystem.existingFiles) {
      parts.push(`- ${file}`);
    }
  }

  if (facts.filesystem.existingDirectories.size > 0) {
    parts.push('\n### 已确认存在的目录:');
    for (const dir of facts.filesystem.existingDirectories) {
      const contents = facts.filesystem.directoryContents.get(dir);
      if (contents && contents.length > 0) {
        parts.push(
          `- ${dir}/ (包含: ${contents.slice(0, DIRECTORY_CONTENT_PREVIEW_LIMIT).join(', ')}${
            contents.length > DIRECTORY_CONTENT_PREVIEW_LIMIT ? '...' : ''
          })`,
        );
      } else {
        parts.push(`- ${dir}/`);
      }
    }
  }

  if (facts.filesystem.nonExistentPaths.size > 0) {
    parts.push('\n### 已确认不存在的路径:');
    for (const path of facts.filesystem.nonExistentPaths) {
      parts.push(`- ${path}`);
    }
  }

  if (
    facts.dependencies.installedPackages.size > 0 ||
    facts.dependencies.missingPackages.size > 0
  ) {
    parts.push('\n## 依赖状态');

    if (facts.dependencies.installedPackages.size > 0) {
      parts.push('\n### 已安装的包:');
      parts.push(Array.from(facts.dependencies.installedPackages).join(', '));
    }

    if (facts.dependencies.missingPackages.size > 0) {
      parts.push('\n### 缺失的包:');
      parts.push(Array.from(facts.dependencies.missingPackages).join(', '));
    }
  }

  parts.push('\n## 项目状态');
  parts.push(
    `- 开发服务器: ${
      facts.project.devServerRunning
        ? `运行中${facts.project.runningPort ? ` (端口: ${facts.project.runningPort})` : ''}`
        : '未运行'
    }`,
  );
  if (facts.project.buildStatus && facts.project.buildStatus !== 'unknown') {
    parts.push(`- 构建状态: ${facts.project.buildStatus === 'success' ? '成功' : '失败'}`);
  }

  if (facts.moduleDependencyGraph.modules.size > 0) {
    parts.push('\n## 已创建的模块');

    const byType = new Map<string, ModuleInfo[]>();
    for (const module of facts.moduleDependencyGraph.modules.values()) {
      const list = byType.get(module.type) || [];
      list.push(module);
      byType.set(module.type, list);
    }

    for (const [type, modules] of byType) {
      parts.push(`\n### ${type} (${modules.length}个):`);
      for (const m of modules) {
        const exportInfo = m.defaultExport
          ? `默认导出: ${m.defaultExport}`
          : m.exports.length > 0
            ? `导出: ${m.exports.slice(0, MODULE_EXPORT_PREVIEW_LIMIT).join(', ')}${
                m.exports.length > MODULE_EXPORT_PREVIEW_LIMIT ? '...' : ''
              }`
            : '无导出';
        parts.push(`- ${m.path} (${exportInfo})`);
      }
    }

    const missingModuleReferences = options.missingModuleReferences ?? [];
    if (missingModuleReferences.length > 0) {
      parts.push('\n### ⚠️ 缺失的模块引用:');
      for (const { from, importPath } of missingModuleReferences.slice(
        0,
        MISSING_MODULE_REFERENCE_LIMIT,
      )) {
        parts.push(`- ${from} 引用了不存在的模块: ${importPath}`);
      }
      if (missingModuleReferences.length > MISSING_MODULE_REFERENCE_LIMIT) {
        parts.push(
          `... 还有 ${missingModuleReferences.length - MISSING_MODULE_REFERENCE_LIMIT} 个缺失引用`,
        );
      }
    }
  }

  if (facts.errors.length > 0) {
    parts.push('\n## 最近的错误 (最多显示5条)');
    const recentErrors = facts.errors.slice(-RECENT_ERROR_LIMIT);
    for (const error of recentErrors) {
      parts.push(`- [${error.type}] ${error.message}`);
    }
  }

  return parts.join('\n');
}
