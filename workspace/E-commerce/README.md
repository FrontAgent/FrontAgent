type ApiErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'
  | 'NETWORK_ERROR'
  | 'UNKNOWN_ERROR';

interface ApiError {
  name: 'ApiError';
  status: number;
  code: ApiErrorCode;
  message: string;
  details?: unknown;
  requestId?: string;
}

说明：

- status：HTTP 状态码（如 400/401/403/404/500）
- code：业务错误码（用于更稳定地做分支）
- message：面向用户/开发者的错误消息（视项目约定）
- details：后端附加信息（字段校验错误、上下文等）
- requestId：便于排查问题的请求标识（如后端返回）

---

## Mock（MSW）

### 启用 Mock

当设置：

VITE_USE_MOCK=true

项目将启用 MSW 拦截请求并返回 mock 数据，适用于：

- 本地开发后端尚未就绪
- 联调前的页面开发
- 稳定复现特定错误/边界场景
- 测试环境（配合 `server` 端初始化）

通常会在应用入口（例如 `src/main.tsx`）根据环境变量决定是否启动 mock（按项目实现为准）。

### 扩展 handlers

Mock 请求处理一般集中在：

src/mocks/handlers

扩展步骤（建议）：

1. 在 `src/mocks/handlers` 中新增或修改对应领域的 handler（如 products、orders、auth）
2. 将新 handler 导出并合并到总 handlers 中（通常在 `src/mocks/handlers/index.ts`）
3. 确保 mock 初始化文件引用的是最新的 handlers 列表

编写 handler 时建议：

- 与真实 API 的路径/方法/结构保持一致
- 对错误场景（401/403/404/500）提供可切换的模拟方式（便于验证 UI 错误处理）
- 将 mock 数据抽到单独的 `fixtures` 或 `data` 文件，避免 handler 过长

---

## 常见问题（FAQ）

### 1) 5173 端口占用

现象：
启动 `dev` 时提示端口被占用，或自动切换到其他端口。

解决方案：

- 关闭占用 5173 端口的进程，或
- 在启动时指定端口（如项目已支持），或
- 修改 Vite 配置中的 server.port（如项目配置允许）

可用命令（示例）查看占用进程：

macOS/Linux:
lsof -i :5173

Windows（PowerShell）:
netstat -ano | findstr :5173

### 2) MSW 初始化失败 / 控制台提示 worker 注册失败

常见原因与排查方向：

- Mock 未正确初始化：确保在启用 Mock 时确实执行了 `worker.start()`（browser 环境）
- Service Worker 文件缺失：确保 MSW 的 worker 文件已生成并位于正确路径
- 访问协议/域名不一致：某些情况下 http/https 或 host 变化会导致 worker 失效
- 浏览器缓存：尝试清理站点数据或在 DevTools Application 中手动 unregister service worker

建议排查步骤：

1. 确认 `.env.local` 中 `VITE_USE_MOCK=true`
2. 打开控制台查看是否有明确的 worker 注册错误
3. 在 Application -> Service Workers 中确认是否成功注册
4. 若有 worker 文件路径相关错误，重新生成/拷贝 worker 文件（按项目 MSW 集成方式执行）

### 3) 请求没有被 MSW 拦截（仍然打到真实后端）

可能原因：

- VITE_USE_MOCK 未生效（需要重启 dev server）
- handler 路径/方法不匹配（例如 GET/POST 写错，或路径缺少前缀）
- 代码里请求使用了不同的 baseURL，导致与 MSW 匹配规则不一致

排查建议：

- 重启开发服务器
- 在 handler 中开启日志或返回明显的标记字段确认是否命中
- 确保请求 URL 与 handler 一致（包含路径、method、query）

---

## 贡献与约定（可选）

- 保持 API 类型定义与实现同文件/同模块内聚
- 页面组件尽量“薄”，将业务逻辑下沉到 hooks/stores/services
- 对关键领域（auth/orders/products）建立明确的 types 与边界

---