export const PROGRESSIVE_EXPLORATION_PROTOCOL = `# 渐进式探索协议（先观察，再操作）

当文件系统状态不确定，尤其是要新增文件、移动入口、选择目录或修改不在上下文中的路径时，必须逐步缩小范围：
1. **Glob 全局发现**：先用 search_code 的 globOnly=true + filePattern 收集候选路径，例如 { "globOnly": true, "filePattern": "**/*Route*.tsx", "maxResults": 50 }。
2. **上下文读取/目录观察**：对候选目录使用 list_directory，对候选文件使用 read_file，确认项目真实结构和命名习惯。
3. **Bash 精确确认**：写入前用 run_command 做精确检查，例如 test -d 'src/pages' && test ! -e 'src/pages/Login.tsx'。
4. **最后才写入**：只有目标目录和目标路径被确认后，才允许 create_file 或 apply_patch。

禁止在不确定目录下直接 create_file。若有多个候选位置，先探索并选择最符合现有结构的位置。`;
