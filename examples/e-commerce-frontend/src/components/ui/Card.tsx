import React from 'react';

export interface ICardProps {
  /** 卡片标题 */
  title?: string;
  /** 卡片内容 */
  children: React.ReactNode;
  /** 自定义样式类名 */
  className?: string;
  /** 是否显示边框 */
  bordered?: boolean;
  /** 是否显示阴影 */
  shadowed?: boolean;
  /** 是否显示圆角 */
  rounded?: boolean;
  /** 内边距大小 */
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

/**
 * 卡片容器组件
 * 用于展示内容块，支持多种样式配置
 */
export const Card: React.FC<ICardProps> = ({
  title,
  children,
  className = '',
  bordered = true,
  shadowed = true,
  rounded = true,
  padding = 'md'
}) => {
  /** 构建样式类名 */
  const getCardClasses = (): string => {
    const baseClasses = ['bg-white'];
    
    if (bordered) {
      baseClasses.push('border border-gray-200');
    }
    
    if (shadowed) {
      baseClasses.push('shadow-sm');
    }
    
    if (rounded) {
      baseClasses.push('rounded-lg');
    }
    
    // 内边距样式
    const paddingClasses = {
      none: '',
      sm: 'p-3',
      md: 'p-4',
      lg: 'p-6'
    };
    
    baseClasses.push(paddingClasses[padding]);
    
    if (className) {
      baseClasses.push(className);
    }
    
    return baseClasses.join(' ');
  };

  return (
    <div className={getCardClasses()}>
      {title && (
        <div className="mb-3 pb-2 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">
            {title}
          </h3>
        </div>
      )}
      <div className="card-content">
        {children}
      </div>
    </div>
  );
};

export default Card;