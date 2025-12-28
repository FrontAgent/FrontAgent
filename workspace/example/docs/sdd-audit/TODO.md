type AuditPriority = 'P0' | 'P1' | 'P2' | 'P3';
type AuditTodoType =
  | 'protected/needs-approval'
  | 'banned-package'
  | 'banned-pattern'
  | 'import-boundary'
  | 'naming-export'
  | 'size-limit'
  | 'docs/process';

interface AuditTodoRow {
  priority: AuditPriority;
  type: AuditTodoType;
  file: string;
  detail: string;
  notesOrNeedsApproval: string;
}

interface Section {
  title: string;
  body: string;
}

interface AuditTemplate {
  readonly projectName: string;
  readonly projectType: string;
  readonly generatedAtIso: string;
  readonly sections: readonly Section[];
  readonly todoRows: readonly AuditTodoRow[];
}

const NEWLINE = '\n';

const escapeCell = (value: string): string => value.replace(/\|/g, '\\|').replace(/\r?\n/g, '<br/>');

const renderTable = (rows: readonly AuditTodoRow[]): string => {
  const header = ['priority', 'type', 'file', 'detail', 'notes/needs-approval'];
  const divider = header.map(() => '---');

  const toRow = (cells: readonly string[]): string => `| ${cells.map(escapeCell).join(' | ')} |`;

  const lines: string[] = [];
  lines.push(toRow(header));
  lines.push(toRow(divider));

  if (rows.length === 0) {
    lines.push(
      toRow([
        '',
        '',
        '',
        '（填写：问题描述/违反的 SDD 约束/触发位置）',
        '（填写：是否需要人工审批/阻断原因/跟进人/链接）',
      ]),
    );
    return lines.join(NEWLINE);
  }

  for (const r of rows) {
    lines.push(toRow([r.priority, r.type, r.file, r.detail, r.notesOrNeedsApproval]));
  }

  return lines.join(NEWLINE);
};

const renderSections = (sections: readonly Section[]): string =>
  sections
    .map((s) => {
      const title = `## ${s.title}`;
      const body = s.body.trim().length > 0 ? s.body.trim() : '';
      return body.length > 0 ? `${title}${NEWLINE}${NEWLINE}${body}` : title;
    })
    .join(`${NEWLINE}${NEWLINE}`);

const renderTemplate = (template: AuditTemplate): string => {
  const headerLines: string[] = [];
  headerLines.push(`# SDD 审计清单（填报模板）`);
  headerLines.push('');
  headerLines.push(`- 项目：${template.projectName}`);
  headerLines.push(`- 类型：${template.projectType}`);
  headerLines.push(`- 生成时间（ISO）：${template.generatedAtIso}`);
  headerLines.push(`- 审计人：`);
  headerLines.push(`- 审计范围（commit/branch/tag）：`);
  headerLines.push(`- 审计工具/命令（可选）：`);
  headerLines.push('');

  const sections = renderSections(template.sections);

  const todoTitle = `## 按优先级排列的待办（Audit TODOs）`;
  const todoHint = [
    `> 说明：此表仅用于后续审计填报，不代表当前仓库存在任何命中。`,
    `> priority 建议：P0（阻断/安全/会导致生产事故）> P1（重要）> P2（一般）> P3（建议/优化）`,
  ].join(NEWLINE);

  const todoTable = renderTable(template.todoRows);

  return [
    headerLines.join(NEWLINE),
    sections,
    `${todoTitle}${NEWLINE}${NEWLINE}${todoHint}${NEWLINE}${NEWLINE}${todoTable}`,
    '',
  ].join(`${NEWLINE}${NEWLINE}`);
};

const template: AuditTemplate = {
  projectName: 'e-commerce-frontend',
  projectType: 'react-spa',
  generatedAtIso: new Date().toISOString(),
  sections: [
    {
      title: '背景与 SDD 关键约束摘要',
      body: [
        `### 背景`,
        `- 本文档用于对仓库进行 SDD（Software Design Document）约束合规性审计，并作为后续整改与审批的填报载体。`,
        `- 本模板不包含任何“已命中/已违规”的具体结论；请在审计过程中将发现记录到下方“待办表格”。`,
        ``,
        `### 技术栈约束（必须遵守）`,
        `- Framework: react ^18.0.0`,
        `- Language: typescript`,
        `- Styling: tailwindcss`,
        `- State: zustand`,
        ``,
        `### 禁止使用的包（必须为 0 命中）`,
        `- jquery`,
        `- moment`,
        `- lodash`,
        `- axios`,
        ``,
        `### 全局代码质量要求（必须遵守）`,
        `- 单个函数最大行数：50`,
        `- 单个文件最大行数：300（另有目录级更严格限制见下）`,
        `- 函数最大参数数量：4`,
        `- 需要 JSDoc 注释：Yes（请抽查关键模块/公共 API/复杂逻辑）`,
        ``,
        `### 禁止出现的代码模式（必须为 0 命中）`,
        `- any`,
        `- // @ts-ignore`,
        `- // @ts-nocheck`,
        `- console.log`,
        `- debugger`,
        `- eval(`,
        `- innerHTML`,
        ``,
        `### 目录规则（命名/导出/行数/行为）`,
        `- src/components/`,
        `  - 命名：PascalCase`,
        `  - 最大行数：300`,
        `  - 必须导出：default`,
        `- src/components/ui/`,
        `  - 命名：PascalCase`,
        `  - 最大行数：150`,
        `  - 禁止：fetch`,
        `- src/hooks/`,
        `  - 命名：use*.ts`,
        `- src/utils/`,
        `  - 命名：camelCase`,
        `  - 最大行数：100`,
        `  - 必须是纯函数`,
        `- src/api/`,
        `  - 命名：camelCase`,
        `  - 最大行数：200`,
        `- src/stores/`,
        `  - 命名：use*Store.ts`,
        `  - 最大行数：200`,
        ``,
        `### 受保护/需审批边界（审计记录重点）`,
        `- 受保护目录（禁止修改）：node_modules/、.git/、dist/、build/`,
        `- 受保护文件（禁止修改）：package.json、lockfiles、tsconfig.json、vite.config.ts、.env*`,
        `- 需要人工审批的修改：`,
        `  - *.config.*`,
        `  - src/api/*`,
        `  - src/stores/*`,
        `  - src/utils/auth*`,
        ``,
        `### 模块导入边界（必须遵守）`,
        `- src/components/ui/*`,
        `  - ✅ 可导入：src/utils/*、src/types/*`,
        `  - 🚫 禁止导入：src/api/*、src/stores/*、src/hooks/*、src/components/features/*`,
        `- src/components/features/*`,
        `  - ✅ 可导入：src/components/ui/*、src/hooks/*、src/utils/*、src/types/*、src/stores/*`,
        `  - 🚫 禁止导入：src/api/*、src/pages/*`,
        `- src/hooks/*`,
        `  - ✅ 可导入：src/api/*、src/utils/*、src/types/*、src/stores/*`,
        `  - 🚫 禁止导入：src/components/*、src/pages/*`,
        `- src/pages/*`,
        `  - ✅ 可导入：src/components/*、src/hooks/*、src/utils/*、src/types/*、src/stores/*`,
        `  - 🚫 禁止导入：src/api/*`,
        ``,
        `### 命名规范（必须遵守）`,
        `- Components：PascalCase`,
        `- Hooks：camelCase 且 use 前缀`,
        `- Utils：camelCase`,
        `- Constants：SCREAMING_SNAKE_CASE`,
        `- Types：Interface 以 I 前缀、type alias 以 T 前缀（均 PascalCase）`,
      ].join(NEWLINE),
    },
    {
      title: '扫描项：受保护/需审批',
      body: [
        `### 目标`,
        `- 识别任何触达受保护目录/文件的修改尝试（应为 0）。`,
        `- 识别所有“需要人工审批”的变更点，并确保有对应审批记录/链接。`,
        ``,
        `### 检查清单`,
        `- [ ] 是否存在对受保护目录（node_modules/.git/dist/build）的修改痕迹？`,
        `- [ ] 是否存在对受保护文件（package.json、lockfiles、tsconfig、vite.config、.env*）的修改？`,
        `- [ ] 是否涉及 *.config.* 修改？如有，是否标记 needs-approval 并附审批信息？`,
        `- [ ] 是否涉及 src/api/* 修改？如有，是否标记 needs-approval 并附安全审查/审批信息？`,
        `- [ ] 是否涉及 src/stores/* 修改？如有，是否标记 needs-approval 并附审批信息？`,
        `- [ ] 是否涉及 src/utils/auth* 修改？如有，是否标记 needs-approval 并附审批信息？`,
      ].join(NEWLINE),
    },
    {
      title: '扫描项：禁用包（dependencies）',
      body: [
        `### 目标`,
        `- 确保依赖树中不出现禁用包（直接/间接，按策略要求记录）。`,
        ``,
        `### 检查清单`,
        `- [ ] package.json / lockfile 是否引入：jquery / moment / lodash / axios（应为 0）？`,
        `- [ ] 是否存在通过子依赖间接引入禁用包？若策略要求禁止间接依赖，也需记录到 TODO。`,
        `- [ ] 若发现替代方案：是否符合技术栈与项目约束（react、typescript、zustand、tailwindcss）？`,
        ``,
        `### 记录要求（填入待办表）`,
        `- priority：按风险与范围评估（P0/P1/P2/P3）`,
        `- type：banned-package`,
        `- file：package.json / lockfile / 触发导入位置`,
        `- detail：包名、版本、来源（direct/indirect）、替代建议`,
        `- notes/needs-approval：如涉及受保护文件或需审批范围，注明审批链接`,
      ].join(NEWLINE),
    },
    {
      title: '扫描项：禁用代码模式（静态扫描）',
      body: [
        `### 目标`,
        `- 确保仓库中不出现 SDD 明确禁止的语法/写法（应为 0）。`,
        ``,
        `### 禁用模式清单（必须为 0 命中）`,
        `- any`,
        `- // @ts-ignore`,
        `- // @ts-nocheck`,
        `- console.log`,
        `- debugger`,
        `- eval(`,
        `- innerHTML`,
        ``,
        `### 检查清单`,
        `- [ ] 全仓搜索上述关键字（注意误报：字符串字面量/注释中的示例需人工复核）`,
        `- [ ] any 是否出现在类型声明、第三方适配层、临时修复中？`,
        `- [ ] 是否存在规避类型检查的注释（@ts-ignore/@ts-nocheck）？`,
        `- [ ] 是否存在调试残留（console.log/debugger）？`,
        `- [ ] 是否存在动态执行（eval）或不安全 DOM 注入（innerHTML）？`,
        ``,
        `### 记录要求（填入待办表）`,
        `- type：banned-pattern`,
        `- file：具体文件路径+行号（如可得）`,
        `- detail：命中模式、上下文与风险说明`,
      ].join(NEWLINE),
    },
    {
      title: '扫描项：导入边界（模块依赖约束）',
      body: [
        `### 目标`,
        `- 验证各目录模块导入关系符合 SDD 的边界定义（应为 0 违规）。`,
        ``,
        `### 检查清单`,
        `- [ ] src/components/ui/* 是否仅导入 src/utils/*、src/types/*？`,
        `- [ ] src/components/ui/* 是否避免导入 src/api/*、src/stores/*、src/hooks/*、src/components/features/*？`,
        `- [ ] src/components/features/* 是否避免导入 src/api/*、src/pages/*？`,
        `- [ ] src/hooks/* 是否避免导入 src/components/*、src/pages/*？`,
        `- [ ] src/pages/* 是否避免导入 src/api/*？`,
        ``,
        `### 记录要求（填入待办表）`,
        `- type：import-boundary`,
        `- file：违规导入所在文件`,
        `- detail：来源模块 -> 目标模块 的违规链路（最好给出 import 语句片段/行号）`,
      ].join(NEWLINE),
    },
    {
      title: '扫描项：命名与导出规范',
      body: [
        `### 目标`,
        `- 验证文件/符号命名、导出方式符合 SDD。`,
        ``,
        `### 检查清单（目录级）`,
        `- [ ] src/components/ 下组件文件是否 PascalCase 命名？是否 default export？`,
        `- [ ] src/components/ui/ 下组件文件是否 PascalCase 命名？是否避免 fetch 使用？`,
        `- [ ] src/hooks/ 下文件是否 use*.ts 命名？hooks 函数是否 use 前缀且 camelCase？`,
        `- [ ] src/utils/ 下文件是否 camelCase 命名？导出的工具函数是否保持纯函数（无副作用/不依赖外部可变状态）？`,
        `- [ ] src/api/ 下文件是否 camelCase 命名？`,
        `- [ ] src/stores/ 下文件是否 use*Store.ts 命名？`,
        ``,
        `### 检查清单（类型/常量）`,
        `- [ ] 常量是否 SCREAMING_SNAKE_CASE？`,
        `- [ ] interface 是否 I 前缀（PascalCase）？`,
        `- [ ] type alias 是否 T 前缀（PascalCase）？`,
        ``,
        `### 记录要求（填入待办表）`,
        `- type：naming-export`,
        `- file：具体文件或目录`,
        `- detail：命名/导出不符合项与建议修复方式`,
      ].join(NEWLINE),
    },
    {
      title: '扫描项：尺寸限制（行数/参数/复杂度的代理指标）',
      body: [
        `### 目标`,
        `- 验证文件与函数满足尺寸限制与可维护性要求。`,
        ``,
        `### 限制回顾（强制）`,
        `- 单文件最大行数：300（全局）`,
        `- src/components/ui/：最大行数 150`,
        `- src/utils/：最大行数 100`,
        `- src/api/：最大行数 200`,
        `- src/stores/：最大行数 200`,
        `- 单个函数最大行数：50`,
        `- 函数最大参数数量：4`,
        ``,
        `### 检查清单`,
        `- [ ] 是否存在超出目录/全局行数限制的文件？`,
        `- [ ] 是否存在超出 50 行的函数？是否可拆分为更小的纯函数/自定义 hook/组件？`,
        `- [ ] 是否存在参数超过 4 个的函数？是否应使用对象参数或拆分职责？`,
        `- [ ] 关键逻辑是否具备必要的 JSDoc（尤其是 utils/api/stores 公共接口）？`,
        ``,
        `### 记录要求（填入待办表）`,
        `- type：size-limit`,
        `- file：具体文件路径`,
        `- detail：超限指标（行数/函数名/参数数量）与建议拆分方向`,
      ].join(NEWLINE),
    },
  ],
  todoRows: [],
};

const content: string = renderTemplate(template);

export default content;