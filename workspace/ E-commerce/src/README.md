# src 目录结构约定

本目录用于承载前端业务代码，按职责分层组织。各目录均包含 `.gitkeep` 以确保空目录能被版本控制。

## 目录说明

- pages/
  - 路由页面（按业务/路由分模块组织）
  - 约定：一个路由对应一个页面入口；页面内可包含仅服务于该页面的局部组件（优先放到 `pages/<module>/components`）

- components/
  - 通用/跨页面可复用组件（UI 组件、业务无关组件）
  - 约定：组件应自包含（样式、测试、类型定义）；对外导出统一从目录 `index.ts` 汇总（如项目采用此约定）

- layouts/
  - 布局组件（页面骨架、导航、侧边栏、页头页脚等）
  - 约定：布局只负责结构与通用容器逻辑，不承载具体业务数据获取

- api/
  - 请求封装与接口定义（HTTP client、拦截器、接口模块）
  - 约定：按业务域拆分文件；导出类型与请求函数；统一处理错误与鉴权；避免在组件内散落拼接 URL

- store/
  - 状态管理（全局状态、模块状态、selectors、actions）
  - 约定：按模块拆分；状态与副作用逻辑集中管理；对外提供清晰的 hooks/selector API

- hooks/
  - 自定义 hooks（复用逻辑、数据订阅、生命周期封装）
  - 约定：命名以 `use` 开头；保持单一职责；避免与 UI 强耦合

- assets/
  - 静态资源（图片、字体、svg 等）
  - 约定：按类型或业务模块分层；避免在代码中使用相对路径乱散引用（可结合别名）

- styles/
  - 样式资源（全局样式、变量、主题、模块样式）
  - 约定：全局样式集中入口；主题/变量独立管理；组件样式优先就近（如使用 CSS Modules/Styled Components 等）

## .gitkeep

以下目录包含 `.gitkeep` 以保证目录结构落地并纳入版本控制：

- src/pages/.gitkeep
- src/components/.gitkeep
- src/layouts/.gitkeep
- src/api/.gitkeep
- src/store/.gitkeep
- src/hooks/.gitkeep
- src/assets/.gitkeep
- src/styles/.gitkeep