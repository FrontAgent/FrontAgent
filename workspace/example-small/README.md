# Example Small - 组件迁移测试项目

这是一个用于测试 FrontAgent 代码重构能力的小型项目。

## 项目背景

- 当前使用了**自定义组件**（Button, Card, Badge, Tag 等）
- 需要将所有自定义组件**替换为 ant-design 组件**
- 测试 FrontAgent 的代码理解和重构能力

## 当前技术栈

- React 18
- TypeScript
- Vite
- Tailwind CSS
- 自定义组件

## 目标技术栈

- React 18
- TypeScript
- Vite
- **Ant Design 5** (替换所有自定义组件)

## 需要替换的组件

- `src/components/Button.tsx` → `antd` 的 `Button`
- `src/components/Card.tsx` → `antd` 的 `Card`
- `src/components/Badge.tsx` → `antd` 的 `Badge`
- `src/components/Tag.tsx` → `antd` 的 `Tag`
- `src/components/Header.tsx` → `antd` 的 `Layout.Header`
- `src/components/ProductCard.tsx` → 使用 `antd` 组件重构

## 使用 FrontAgent 测试

```bash
cd workspace/example-small
frontagent run "根据 SDD 要求，将所有自定义组件替换为 ant-design 组件"
```

## 验收标准

- ✅ 所有自定义组件文件被删除或重构
- ✅ 所有组件导入改为从 `antd` 导入
- ✅ package.json 包含 `antd` 和 `@ant-design/icons` 依赖
- ✅ 页面功能和样式保持一致
- ✅ TypeScript 类型检查通过
- ✅ 项目可以正常运行
