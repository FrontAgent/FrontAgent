import React from 'react';

/**
 * Card 组件的属性接口
 */
export interface ICardProps {
  /** 卡片内容 */
  children: React.ReactNode;
  /** 自定义类名 */
  className?: string;
  /** 内边距大小 */
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /** 阴影大小 */
  shadow?: 'none' | 'sm' | 'md' | 'lg';
  /** 是否显示悬停效果 */
  hoverable?: boolean;
}

/**
 * 卡片基础 UI 组件
 * 
 * @example
 * ```tsx
 * <Card padding="md" shadow="lg" hoverable>
 *   <h2>标题</h2>
 *   <p>内容</p>
 * </Card>
 * ```
 */
const Card: React.FC<ICardProps> = ({
  children,
  className = '',
  padding = 'md',
  shadow = 'md',
  hoverable = false,
}) => {
  const paddingClasses = {
    none: '',
    sm: 'p-2',
    md: 'p-4',
    lg: 'p-6',
  };

  const shadowClasses = {
    none: '',
    sm: 'shadow-sm',
    md: 'shadow-md',
    lg: 'shadow-lg',
  };

  const hoverClasses = hoverable
    ? 'hover:shadow-xl hover:scale-[1.02] transition-all duration-300 cursor-pointer'
    : '';

  const classes = [
    'bg-white',
    'rounded-lg',
    paddingClasses[padding],
    shadowClasses[shadow],
    hoverClasses,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return <div className={classes}>{children}</div>;
};

export default Card;