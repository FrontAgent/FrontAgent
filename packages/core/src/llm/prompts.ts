export const PROGRESSIVE_EXPLORATION_PROTOCOL = `# 渐进式探索协议（先观察，再操作）

当文件系统状态不确定，尤其是要新增文件、移动入口、选择目录或修改不在上下文中的路径时，必须逐步缩小范围：
1. **Glob 全局发现**：先用 search_code 的 globOnly=true + filePattern 收集候选路径，例如 { "globOnly": true, "filePattern": "**/*Route*.tsx", "maxResults": 50 }。
2. **上下文读取/目录观察**：对候选目录使用 list_directory，对候选文件使用 read_file，确认项目真实结构和命名习惯。
3. **Bash 精确确认**：写入前用 run_command 做精确检查，例如 test -d 'src/pages' && test ! -e 'src/pages/Login.tsx'。
4. **最后才写入**：只有目标目录和目标路径被确认后，才允许 create_file 或 apply_patch。

禁止在不确定目录下直接 create_file。若有多个候选位置，先探索并选择最符合现有结构的位置。`;

export const EXTERNAL_KNOWLEDGE_PROTOCOL = `# 外部知识纪律（先核实，再假设）

当任务涉及你不能完全确定的外部知识时，先核实再下计划或写代码，不要凭部分印象臆测 API 的形状或默认行为：
1. **识别需要核实的信号**：遇到**不熟悉**、**版本特定**或**最近才出现**的库、框架、API 时，视为需要核实。
2. **先 web_fetch 权威来源**：在排定计划或生成代码之前，先安排 web_fetch 查阅官方文档 / API 参考等权威来源，确认 API 的签名、形状与默认行为，再据此制定步骤。
3. **以核实结果为准**：让计划与代码贴合查阅到的事实，而不是贴合模糊记忆；存疑处优先标注为需要先 web_fetch 的步骤。

反向约束（防无谓抓取）：对你已经熟知且稳定的知识，无需 web_fetch；不要为常识性、稳定的 API 反复抓取，避免无意义的外部请求。`;
