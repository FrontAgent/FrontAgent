// 推荐的组件结构
import React from 'react';
import type { FC } from 'react';

interface ComponentProps {
  title: string;
  onAction?: () => void;
}

export const Component: FC<ComponentProps> = ({ title, onAction }) => {
  return (
    <div>
      <h1>{title}</h1>
    </div>
  );
};
```

### Git 提交规范

遵循 Conventional Commits 规范:

- `feat`: 新功能
- `fix`: 修复 bug
- `docs`: 文档更新
- `style`: 代码格式调整
- `refactor`: 代码重构
- `test`: 测试相关
- `chore`: 构建/工具链更新

示例:
```
feat: 添加用户登录功能
fix: 修复导航栏样式问题
docs: 更新 README 文档
```

## 🔧 配置说明

### Vite 配置

项目使用 Vite 作为构建工具，配置文件为 `vite.config.ts`。主要特性:

- 快速的冷启动
- 即时的模块热更新 (HMR)
- 优化的生产构建

### TypeScript 配置

TypeScript 配置文件为 `tsconfig.json`，启用严格模式以获得更好的类型安全。

### Tailwind CSS

使用 Tailwind CSS 进行样式开发，配置文件为 `tailwind.config.js`。

## 📦 可用脚本

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 构建生产版本 |
| `npm run preview` | 预览生产构建 |
| `npm run lint` | 运行 ESLint 检查 |
| `npm run lint:fix` | 自动修复 ESLint 问题 |
| `npm run format` | 使用 Prettier 格式化代码 |

## 🤝 贡献指南

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'feat: add some amazing feature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件

## 📮 联系方式

如有问题或建议，欢迎提交 Issue 或 Pull Request。

---

**Happy Coding! 🎉**