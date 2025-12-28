# E-Commerce Frontend Project

一个现代化的电商前端项目，使用 React 18 和 TypeScript 构建。

## 项目简介

这是一个功能完整的电商前端应用，提供商品浏览、购物车管理、用户认证等核心电商功能。项目采用现代化的技术栈，注重用户体验和代码质量。

## 技术栈

- **React 18** - 用户界面库
- **TypeScript** - 类型安全的 JavaScript 超集
- **Vite** - 下一代前端构建工具
- **Tailwind CSS** - 实用优先的 CSS 框架
- **Zustand** - 轻量级状态管理
- **React Router** - 客户端路由
- **Axios** - HTTP 客户端
- **React Query** - 数据获取和缓存
- **ESLint** - 代码质量检查
- **Prettier** - 代码格式化

## 功能特性

- ✅ 商品展示和分类浏览
- ✅ 商品搜索和筛选
- ✅ 购物车管理（添加、删除、修改数量）
- ✅ 用户认证（登录、注册、登出）
- ✅ 订单管理
- ✅ 响应式设计（支持移动端和桌面端）
- ✅ 深色模式支持
- ✅ 国际化支持
- ✅ 性能优化（懒加载、代码分割）
- ✅ SEO 友好

## 快速开始

### 前置要求

- Node.js >= 16.0.0
- npm >= 8.0.0 或 yarn >= 1.22.0

### 安装依赖

npm install

或使用 yarn：

```bash
yarn install
```

### 启动开发服务器

```bash
npm run dev
```

应用将在 `http://localhost:5173` 启动

### 构建生产版本

```bash
npm run build
```

构建产物将输出到 `dist` 目录

### 预览生产构建

```bash
npm run preview
```

### 运行测试

```bash
npm run test
```

### 代码检查

```bash
npm run lint
```

### 代码格式化

```bash
npm run format
```

## 项目结构

```
src/
├── assets/          # 静态资源（图片、字体等）
├── components/      # 可复用组件
│   ├── common/      # 通用组件（Button、Input 等）
│   ├── layout/      # 布局组件（Header、Footer 等）
│   └── features/    # 功能组件（ProductCard、CartItem 等）
├── pages/           # 页面组件
│   ├── Home/        # 首页
│   ├── Products/    # 商品列表页
│   ├── ProductDetail/ # 商品详情页
│   ├── Cart/        # 购物车页
│   └── Auth/        # 认证页面
├── hooks/           # 自定义 React Hooks
├── store/           # Zustand 状态管理
├── services/        # API 服务
├── utils/           # 工具函数
├── types/           # TypeScript 类型定义
├── constants/       # 常量定义
├── styles/          # 全局样式
├── routes/          # 路由配置
├── App.tsx          # 应用根组件
└── main.tsx         # 应用入口
```

## 开发规范

### 代码风格

- 使用 TypeScript 进行类型检查
- 遵循 ESLint 和 Prettier 配置
- 使用函数式组件和 Hooks
- 组件命名使用 PascalCase
- 文件命名使用 PascalCase（组件）或 camelCase（工具函数）

### 组件开发

- 每个组件一个文件
- 使用 TypeScript 定义 Props 类型
- 优先使用组合而非继承
- 保持组件单一职责
- 提取可复用逻辑到自定义 Hooks

### 状态管理

- 使用 Zustand 管理全局状态
- 本地状态使用 useState
- 服务端状态使用 React Query
- 避免过度使用全局状态

### 样式规范

- 使用 Tailwind CSS 实用类
- 复杂样式使用 CSS Modules
- 遵循移动优先原则
- 保持样式的一致性

### Git 提交规范

使用 Conventional Commits 规范：

- `feat:` 新功能
- `fix:` 修复 bug
- `docs:` 文档更新
- `style:` 代码格式调整
- `refactor:` 代码重构
- `test:` 测试相关
- `chore:` 构建/工具相关

示例：
```
feat: 添加商品搜索功能
fix: 修复购物车数量更新问题
docs: 更新 README 文档
```

## 环境变量配置

在项目根目录创建 `.env` 文件：

```env
# API 基础地址
VITE_API_BASE_URL=https://api.example.com

# 应用标题
VITE_APP_TITLE=E-Commerce App

# 启用调试模式
VITE_DEBUG=false

# 分析工具 ID
VITE_GA_ID=UA-XXXXXXXXX-X
```

环境变量说明：

- `VITE_API_BASE_URL`: 后端 API 地址
- `VITE_APP_TITLE`: 应用标题
- `VITE_DEBUG`: 是否启用调试模式
- `VITE_GA_ID`: Google Analytics ID

## 浏览器支持

- Chrome >= 90
- Firefox >= 88
- Safari >= 14
- Edge >= 90

## 性能优化

- 使用 React.lazy 和 Suspense 进行代码分割
- 图片懒加载
- 使用 React.memo 优化组件渲染
- 虚拟滚动处理长列表
- 使用 Web Workers 处理复杂计算

## 部署

### Vercel

```bash
npm run build
vercel --prod
```

### Netlify

```bash
npm run build
netlify deploy --prod --dir=dist
```

### Docker

```dockerfile
FROM node:16-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

## 贡献指南

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'feat: Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 联系方式

- 项目主页: [https://github.com/yourusername/ecommerce-frontend](https://github.com/yourusername/ecommerce-frontend)
- 问题反馈: [https://github.com/yourusername/ecommerce-frontend/issues](https://github.com/yourusername/ecommerce-frontend/issues)

## 致谢

感谢所有为本项目做出贡献的开发者！