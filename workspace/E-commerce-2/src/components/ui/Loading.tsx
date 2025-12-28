import React from 'react';

/**
 * Loading 组件的属性接口
 */
export interface ILoadingProps {
  /**
   * 加载指示器的大小
   * @default 'md'
   */
  size?: 'sm' | 'md' | 'lg';
  
  /**
   * 加载提示文本
   */
  text?: string;
  
  /**
   * 是否全屏显示
   * @default false
   */
  fullScreen?: boolean;
}

/**
 * Loading 组件
 * 显示加载状态的 UI 组件，支持不同尺寸和全屏模式
 * 
 * @param props - 组件属性
 * @returns React 组件
 */
const Loading: React.FC<ILoadingProps> = ({ 
  size = 'md', 
  text, 
  fullScreen = false 
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-3',
    lg: 'w-12 h-12 border-4'
  };

  const textSizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg'
  };

  const spinnerClass = `
    ${sizeClasses[size]}
    border-blue-500
    border-t-transparent
    rounded-full
    animate-spin
  `.trim().replace(/\s+/g, ' ');

  const content = (
    <div className="flex flex-col items-center justify-center gap-3">
      <div className={spinnerClass} role="status" aria-label="Loading" />
      {text && (
        <p className={`${textSizeClasses[size]} text-gray-600 font-medium`}>
          {text}
        </p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white bg-opacity-90 z-50">
        {content}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center p-4">
      {content}
    </div>
  );
};

export default Loading;