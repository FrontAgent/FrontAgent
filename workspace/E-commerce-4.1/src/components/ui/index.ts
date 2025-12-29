/**
 * UI 组件库 Barrel Export
 *
 * 样式约定：
 * - 组件优先使用 className 进行样式组合与覆盖，避免在组件内部写死主题色与尺寸。
 * - 主题与状态使用 CSS Variables（如 --ui-color-primary、--ui-radius、--ui-shadow）实现可配置化。
 * - 若项目使用 Tailwind 等工具类，可通过 className 传入；组件仅提供最小结构与语义化类名。
 * - 组件内部应避免全局样式污染，推荐使用局部作用域（CSS Modules/Scoped）或前缀化类名。
 */

export * from './Button';
export * from './Input';
export * from './Modal';
export * from './Drawer';
export * from './Tabs';
export * from './Pagination';
export * from './Skeleton';
export * from './Empty';
export * from './Toast';