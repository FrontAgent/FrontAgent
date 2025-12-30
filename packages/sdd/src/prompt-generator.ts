/**
 * SDD System Prompt 生成器
 * 将 SDD 配置转换为 LLM System Prompt 中的约束描述
 */

import type { SDDConfig } from '@frontagent/shared';

/**
 * Prompt 生成选项
 */
export interface PromptGeneratorOptions {
  /** 是否包含详细说明 */
  verbose?: boolean;
  /** 语言 */
  language?: 'en' | 'zh';
  /** 自定义前缀 */
  prefix?: string;
  /** 自定义后缀 */
  suffix?: string;
}

/**
 * SDD Prompt 生成器
 */
export class SDDPromptGenerator {
  private config: SDDConfig;
  private options: Required<PromptGeneratorOptions>;

  constructor(config: SDDConfig, options: PromptGeneratorOptions = {}) {
    this.config = config;
    this.options = {
      verbose: options.verbose ?? true,
      language: options.language ?? 'zh',
      prefix: options.prefix ?? '',
      suffix: options.suffix ?? ''
    };
  }

  /**
   * 生成完整的 System Prompt 约束部分
   */
  generate(): string {
    const isZh = this.options.language === 'zh';
    const sections: string[] = [];

    // 标题
    sections.push(isZh
      ? '## 📋 项目约束（来自 SDD - Specification Driven Development）'
      : '## 📋 Project Constraints (from SDD - Specification Driven Development)'
    );

    sections.push('');
    sections.push(isZh
      ? '以下约束是**强制性的**，你的所有操作必须严格遵守：'
      : 'The following constraints are **mandatory**. All your actions must strictly comply:'
    );

    // 1. 项目信息
    sections.push(this.generateProjectSection());

    // 2. 技术栈约束
    sections.push(this.generateTechStackSection());

    // 3. 目录结构约束
    sections.push(this.generateDirectorySection());

    // 4. 模块边界约束
    sections.push(this.generateModuleBoundarySection());

    // 5. 命名规范
    sections.push(this.generateNamingSection());

    // 6. 代码质量约束
    sections.push(this.generateCodeQualitySection());

    // 7. 修改安全边界
    sections.push(this.generateModificationRulesSection());

    // 8. 🔧 修复问题3：迁移需求（如果存在）
    const migrationSection = this.generateMigrationSection();
    if (migrationSection) {
      sections.push(migrationSection);
    }

    // 9. 🔧 修复问题3：其他自定义字段（通用处理）
    const customSection = this.generateCustomFieldsSection();
    if (customSection) {
      sections.push(customSection);
    }

    // 10. 重要提醒
    sections.push(this.generateReminders());

    return [
      this.options.prefix,
      sections.join('\n\n'),
      this.options.suffix
    ].filter(Boolean).join('\n\n');
  }

  /**
   * 生成项目信息部分
   */
  private generateProjectSection(): string {
    const isZh = this.options.language === 'zh';
    return `### ${isZh ? '项目信息' : 'Project Info'}
- **${isZh ? '项目名称' : 'Name'}**: ${this.config.project.name}
- **${isZh ? '项目类型' : 'Type'}**: ${this.config.project.type}
${this.config.project.description ? `- **${isZh ? '描述' : 'Description'}**: ${this.config.project.description}` : ''}`;
  }

  /**
   * 生成技术栈约束部分
   */
  private generateTechStackSection(): string {
    const isZh = this.options.language === 'zh';
    const { techStack } = this.config;

    let section = `### ${isZh ? '技术栈约束' : 'Tech Stack Constraints'}
- **Framework**: ${techStack.framework} ${techStack.version}
- **Language**: ${techStack.language}`;

    if (techStack.styling) {
      section += `\n- **Styling**: ${techStack.styling}`;
    }

    if (techStack.uiLibrary) {
      section += `\n- **UI Library**: ${techStack.uiLibrary}`;
      if (techStack.uiLibraryVersion) {
        section += ` ${techStack.uiLibraryVersion}`;
      }
    }

    if (techStack.routing) {
      section += `\n- **Routing**: ${techStack.routing}`;
    }

    if (techStack.buildTool) {
      section += `\n- **Build Tool**: ${techStack.buildTool}`;
    }

    if (techStack.stateManagement) {
      section += `\n- **State Management**: ${techStack.stateManagement}`;
    }

    // 🚨 关键修复：生成必需依赖列表
    if (techStack.requiredPackages && techStack.requiredPackages.length > 0) {
      section += `\n\n📦 **${isZh ? '必需的依赖包（package.json 中必须包含）' : 'Required Packages (Must be in package.json)'}**:
${techStack.requiredPackages.map(pkg => `- \`${pkg}\``).join('\n')}

⚠️ ${isZh ? '重要提醒：生成 package.json 时，dependencies 或 devDependencies 中必须包含上述所有包！' : 'Important: When generating package.json, all packages above MUST be included in dependencies or devDependencies!'}`;
    }

    if (techStack.forbiddenPackages.length > 0) {
      section += `\n\n🚫 **${isZh ? '禁止使用的包' : 'Forbidden Packages'}**:
${techStack.forbiddenPackages.map(pkg => `- \`${pkg}\``).join('\n')}`;
    }

    return section;
  }

  /**
   * 生成目录结构约束部分
   */
  private generateDirectorySection(): string {
    const isZh = this.options.language === 'zh';
    const { directoryStructure } = this.config;
    const entries = Object.entries(directoryStructure);

    if (entries.length === 0) {
      return '';
    }

    let section = `### ${isZh ? '目录结构规则' : 'Directory Structure Rules'}\n`;

    for (const [path, rules] of entries) {
      section += `\n**\`${path}/\`**:\n`;
      if (rules.pattern) {
        section += `  - ${isZh ? '命名模式' : 'Pattern'}: \`${rules.pattern}\`\n`;
      }
      if (rules.maxLines) {
        section += `  - ${isZh ? '最大行数' : 'Max lines'}: ${rules.maxLines}\n`;
      }
      if (rules.requiredExports && rules.requiredExports.length > 0) {
        section += `  - ${isZh ? '必须导出' : 'Required exports'}: ${rules.requiredExports.join(', ')}\n`;
      }
      if (rules.forbidden && rules.forbidden.length > 0) {
        section += `  - 🚫 ${isZh ? '禁止' : 'Forbidden'}: ${rules.forbidden.join(', ')}\n`;
      }
      if (rules.mustBePure) {
        section += `  - ${isZh ? '必须是纯函数' : 'Must be pure functions'}\n`;
      }
    }

    return section;
  }

  /**
   * 生成模块边界约束部分
   */
  private generateModuleBoundarySection(): string {
    const isZh = this.options.language === 'zh';
    const { moduleBoundaries } = this.config;

    if (moduleBoundaries.length === 0) {
      return '';
    }

    let section = `### ${isZh ? '模块导入边界' : 'Module Import Boundaries'}\n`;
    section += isZh 
      ? '以下是模块间的导入限制：\n'
      : 'The following are import restrictions between modules:\n';

    for (const boundary of moduleBoundaries) {
      section += `\n**\`${boundary.from}\`**:\n`;
      if (boundary.canImport.length > 0) {
        section += `  - ✅ ${isZh ? '可以导入' : 'Can import'}: ${boundary.canImport.map(p => `\`${p}\``).join(', ')}\n`;
      }
      if (boundary.cannotImport.length > 0) {
        section += `  - 🚫 ${isZh ? '不能导入' : 'Cannot import'}: ${boundary.cannotImport.map(p => `\`${p}\``).join(', ')}\n`;
      }
    }

    return section;
  }

  /**
   * 生成命名规范部分
   */
  private generateNamingSection(): string {
    const isZh = this.options.language === 'zh';
    const { namingConventions } = this.config;

    return `### ${isZh ? '命名规范' : 'Naming Conventions'}
| ${isZh ? '类型' : 'Type'} | ${isZh ? '规范' : 'Convention'} |
|------|------|
| Components | ${namingConventions.components} |
| Hooks | ${namingConventions.hooks} |
| Utils | ${namingConventions.utils} |
| Constants | ${namingConventions.constants} |
| Types | ${namingConventions.types} |`;
  }

  /**
   * 生成代码质量约束部分
   */
  private generateCodeQualitySection(): string {
    const isZh = this.options.language === 'zh';
    const { codeQuality } = this.config;

    let section = `### ${isZh ? '代码质量要求' : 'Code Quality Requirements'}
- ${isZh ? '单个函数最大行数' : 'Max function lines'}: **${codeQuality.maxFunctionLines}**
- ${isZh ? '单个文件最大行数' : 'Max file lines'}: **${codeQuality.maxFileLines}**
- ${isZh ? '函数最大参数数量' : 'Max parameters'}: **${codeQuality.maxParameters}**
- ${isZh ? '要求 JSDoc 注释' : 'Require JSDoc'}: **${codeQuality.requireJsdoc ? 'Yes' : 'No'}**`;

    if (codeQuality.forbiddenPatterns.length > 0) {
      section += `\n\n🚫 **${isZh ? '禁止出现的代码模式' : 'Forbidden Code Patterns'}**:
${codeQuality.forbiddenPatterns.map(p => `- \`${p}\``).join('\n')}`;
    }

    return section;
  }

  /**
   * 生成修改安全边界部分
   */
  private generateModificationRulesSection(): string {
    const isZh = this.options.language === 'zh';
    const { modificationRules } = this.config;

    let section = `### ${isZh ? '修改安全边界' : 'Modification Safety Boundaries'}`;

    if (modificationRules.protectedDirectories.length > 0) {
      section += `\n\n🔒 **${isZh ? '受保护目录（禁止修改）' : 'Protected Directories (No Modification)'}**:
${modificationRules.protectedDirectories.map(d => `- \`${d}/\``).join('\n')}`;
    }

    if (modificationRules.protectedFiles.length > 0) {
      section += `\n\n🔒 **${isZh ? '受保护文件（禁止修改）' : 'Protected Files (No Modification)'}**:
${modificationRules.protectedFiles.map(f => `- \`${f}\``).join('\n')}`;
    }

    if (modificationRules.requireApproval.length > 0) {
      section += `\n\n⚠️ **${isZh ? '需要人工审批的修改' : 'Modifications Requiring Approval'}**:
${modificationRules.requireApproval.map(r => `- \`${r.pattern}\`: ${r.reason}`).join('\n')}`;
    }

    return section;
  }

  /**
   * 🔧 修复问题3：生成迁移需求部分（专门处理组件迁移场景）
   */
  private generateMigrationSection(): string | null {
    const isZh = this.options.language === 'zh';
    const config = this.config as any;

    // 检查是否有迁移相关的配置
    if (!config.migration_requirements && !config.migrationRequirements) {
      return null;
    }

    const migrationReqs = config.migration_requirements || config.migrationRequirements;

    let section = `### ${isZh ? '🔄 迁移任务要求' : '🔄 Migration Task Requirements'}\n\n`;

    if (migrationReqs.description) {
      section += `**${isZh ? '迁移说明' : 'Description'}**: ${migrationReqs.description}\n\n`;
    }

    // components_to_remove - 需要删除的组件
    if (migrationReqs.components_to_remove && Array.isArray(migrationReqs.components_to_remove)) {
      section += `**${isZh ? '🗑️ 需要删除的文件' : '🗑️ Files to Delete'}**:\n`;
      for (const component of migrationReqs.components_to_remove) {
        section += `- \`${component.path}\` - ${component.reason || ''}\n`;
      }
      section += '\n';
    }

    // components_to_refactor - 需要重构的组件
    if (migrationReqs.components_to_refactor && Array.isArray(migrationReqs.components_to_refactor)) {
      section += `**${isZh ? '🔧 需要重构的文件' : '🔧 Files to Refactor'}**:\n`;
      for (const component of migrationReqs.components_to_refactor) {
        section += `- \`${component.path}\`:\n`;
        if (component.requirements && Array.isArray(component.requirements)) {
          for (const req of component.requirements) {
            section += `  - ${req}\n`;
          }
        }
      }
      section += '\n';
    }

    // migration_steps - 迁移步骤建议
    const migrationSteps = config.migration_steps || config.migrationSteps;
    if (migrationSteps && Array.isArray(migrationSteps)) {
      section += `**${isZh ? '📋 建议的迁移步骤' : '📋 Recommended Migration Steps'}**:\n`;
      for (const step of migrationSteps) {
        section += `${step.step}. **${step.description}**: ${step.action}\n`;
      }
      section += '\n';
    }

    section += `⚠️ **${isZh ? '重要' : 'Important'}**: ${isZh
      ? '这是一个迁移任务，你需要严格按照上述要求进行文件的删除、重构和修改，而不是创建新的文件！'
      : 'This is a migration task. You MUST follow the requirements above to delete, refactor and modify files, NOT create new files!'}`;

    return section;
  }

  /**
   * 🔧 修复问题3：生成其他自定义字段部分（通用处理）
   */
  private generateCustomFieldsSection(): string | null {
    const config = this.config as any;
    const knownFields = new Set([
      'project', 'techStack', 'directoryStructure', 'moduleBoundaries',
      'namingConventions', 'codeQuality', 'modificationRules',
      'migration_requirements', 'migrationRequirements',
      'migration_steps', 'migrationSteps',
      'component_migration_rules', 'componentMigrationRules',
      'acceptance_criteria', 'acceptanceCriteria',
      'agent_behavior', 'agentBehavior'
    ]);

    const customFields: string[] = [];

    for (const [key, value] of Object.entries(config)) {
      if (!knownFields.has(key) && value !== null && value !== undefined) {
        customFields.push(`**${key}**: ${typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}`);
      }
    }

    if (customFields.length === 0) {
      return null;
    }

    return `### Additional Constraints\n${customFields.join('\n\n')}`;
  }

  /**
   * 生成重要提醒
   */
  private generateReminders(): string {
    const isZh = this.options.language === 'zh';

    return `### ${isZh ? '⚠️ 重要提醒' : '⚠️ Important Reminders'}

${isZh ? `1. **所有代码修改必须通过 MCP 工具执行**，不要直接输出完整代码
2. **遵循最小修改原则**，只修改必要的部分
3. **在修改前必须先读取文件**，了解现有代码结构
4. **所有操作必须可追溯到上述 SDD 约束**
5. **如果操作违反约束，必须明确拒绝并说明原因**`
: `1. **All code modifications must be executed through MCP tools**, do not output complete code directly
2. **Follow minimal modification principle**, only change what's necessary
3. **Must read file before modifying**, understand existing code structure
4. **All actions must be traceable to the SDD constraints above**
5. **If an action violates constraints, must explicitly refuse and explain why**`}`;
  }

  /**
   * 生成简洁版本的约束提示（用于上下文窗口有限时）
   */
  generateCompact(): string {
    const isZh = this.options.language === 'zh';
    const { techStack, codeQuality, modificationRules } = this.config;

    return `## SDD Constraints
- Tech: ${techStack.framework} ${techStack.version}, ${techStack.language}
- Forbidden: ${techStack.forbiddenPackages.join(', ') || 'none'}
- Max lines: file=${codeQuality.maxFileLines}, func=${codeQuality.maxFunctionLines}
- Protected: ${[...modificationRules.protectedFiles, ...modificationRules.protectedDirectories].join(', ')}
- ${isZh ? '必须通过 MCP 工具执行修改' : 'Must use MCP tools for modifications'}`;
  }
}

/**
 * 创建 Prompt 生成器实例
 */
export function createPromptGenerator(
  config: SDDConfig,
  options?: PromptGeneratorOptions
): SDDPromptGenerator {
  return new SDDPromptGenerator(config, options);
}

